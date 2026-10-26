import { getTableName, sql, type SQL } from 'drizzle-orm';
import type { Database, Queryable } from '../database/database.module';
import { MAX_TRANSLATION_ATTEMPTS } from '../database/schema';
import { LOCALES, type Locale } from '../common/locale';
import type { CircuitTable } from '../documents/circuit-queries';
import { textTableOf } from '../documents/document-text-queries';
import { TRANSLATION_LEASE_MINUTES } from './translation-lease';
import type { TranslatedText } from './translator';

/**
 * The translation worker's statements. Each write is one statement guarded by
 * what it depends on — the claim it holds, or the text it translated — so no
 * column is ever computed from a value read in an earlier statement.
 *
 * A claim is identified by its `translation_claimed_at`, carried as text: the
 * column holds microseconds, which a JavaScript `Date` would round away, and
 * then no guard on it would ever match.
 */

const LEASE = sql.raw(`interval '${TRANSLATION_LEASE_MINUTES} minutes'`);

/**
 * Written into the claim as a literal: the planner uses a partial index only
 * where it can prove the query's condition implies the index's, and a bound
 * parameter proves nothing.
 */
const MAX_ATTEMPTS = sql.raw(String(MAX_TRANSLATION_ATTEMPTS));

/** One document the worker holds, with what it needs to translate it. */
export interface ClaimedDocument {
  id: string;
  userId: string;
  name: string;
  description: string;
  textDigest: string;
  textLanguageHint: string | null;
  /**
   * Per field, whether its author has written it in every site language at
   * the claim, which is when the document might be settled without the model.
   */
  authoredEverywhere: { name: boolean; description: boolean };
  /** The claim's own timestamp, as Postgres wrote it. */
  claimedAt: string;
}

interface ClaimedRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  name: string;
  description: string;
  text_digest: string;
  text_language_hint: string | null;
  name_authored: boolean;
  description_authored: boolean;
  claimed_at: string;
}

/**
 * Takes up to `batch` pending documents of one kind, oldest edit first, in one
 * statement. `SKIP LOCKED` keeps two API instances from taking the same row,
 * and the lease brings a crashed worker's rows back.
 *
 * Pending is `translated_digest IS DISTINCT FROM text_digest`, so every write
 * path that changes the text makes the row pending again by itself. A private
 * or hidden document is never taken: it may not leave the database. An empty
 * one, with neither a component nor a wire, is passed by too: it has nothing
 * to show a reader, and a board drawn on later is taken from then, its text
 * still pending. A text that failed {@link MAX_TRANSLATION_ATTEMPTS} times is
 * parked until its digest moves.
 */
export async function claimPending(
  db: Database,
  table: CircuitTable,
  options: { debounceSeconds: number; batch: number }
): Promise<ClaimedDocument[]> {
  const documentId = sql`${sql.identifier(getTableName(table))}.id`;
  // `RETURNING` follows the update's plan, not the subquery's order, so the
  // claimed rows are put back in edit order around it.
  const result = await db.execute<ClaimedRow>(sql`
    WITH claimed AS (
      UPDATE ${table} SET translation_claimed_at = now()
       WHERE id IN (
         SELECT id FROM ${table}
          WHERE translated_digest IS DISTINCT FROM text_digest
            AND visibility <> 'private'
            AND hidden_at IS NULL
            AND (component_count > 0 OR wire_count > 0)
            AND last_edited_at < now() - make_interval(secs => ${options.debounceSeconds})
            AND (translation_claimed_at IS NULL OR translation_claimed_at < now() - ${LEASE})
            AND NOT (translation_attempt_digest = text_digest
                     AND translation_attempts >= ${MAX_ATTEMPTS})
          ORDER BY last_edited_at
          LIMIT ${options.batch}
          FOR UPDATE SKIP LOCKED)
      RETURNING id, user_id, name, description, text_digest, text_language_hint,
                ${authoredInEveryLocale(table, documentId, 'name')} AS name_authored,
                ${authoredInEveryLocale(table, documentId, 'description')} AS description_authored,
                translation_claimed_at::text AS claimed_at, last_edited_at
    )
    SELECT * FROM claimed ORDER BY last_edited_at, id
  `);
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    textDigest: row.text_digest,
    textLanguageHint: row.text_language_hint,
    authoredEverywhere: {
      name: row.name_authored,
      description: row.description_authored
    },
    claimedAt: row.claimed_at
  }));
}

/**
 * Renews the claim right before its call, if the text may still be sent: the
 * document is neither private nor hidden, its text is the one claimed, and the
 * claim is still this worker's. Returns the renewed claim, or null when it may
 * not be sent.
 *
 * A batch is translated one document after another, so a document can be made
 * private while those before it are in flight, and the lease the batch was
 * claimed with can run short. Renewed here, each document's lease covers its
 * own calls from their start, however long the batch before it took.
 */
export async function renewForCall(
  db: Database,
  table: CircuitTable,
  claim: ClaimedDocument
): Promise<ClaimedDocument | null> {
  const result = await db.execute<{ claimed_at: string }>(sql`
    UPDATE ${table} SET translation_claimed_at = now()
     WHERE id = ${claim.id}
       AND visibility <> 'private'
       AND hidden_at IS NULL
       AND text_digest = ${claim.textDigest}
       AND translation_claimed_at = ${claim.claimedAt}::timestamptz
    RETURNING translation_claimed_at::text AS claimed_at
  `);
  const [renewed] = result.rows;
  return renewed ? { ...claim, claimedAt: renewed.claimed_at } : null;
}

/**
 * Gives a claim up without judging the text, so the row is free for the next
 * tick. A claim that has meanwhile run out and been taken by another worker is
 * left to that worker.
 */
export async function releaseClaim(
  db: Database,
  table: CircuitTable,
  claim: ClaimedDocument
): Promise<void> {
  await db.execute(sql`
    UPDATE ${table} SET translation_claimed_at = NULL
     WHERE id = ${claim.id}
       AND translation_claimed_at = ${claim.claimedAt}::timestamptz
  `);
}

/**
 * Holds a row past its lease: the claim time is rewritten so the lease runs
 * out at the moment given, and the row is claimable again from then.
 */
export async function holdClaimUntil(
  db: Database,
  table: CircuitTable,
  claim: ClaimedDocument,
  claimedAt: Date
): Promise<void> {
  await db.execute(sql`
    UPDATE ${table} SET translation_claimed_at = ${claimedAt.toISOString()}::timestamptz
     WHERE id = ${claim.id}
       AND translation_claimed_at = ${claim.claimedAt}::timestamptz
  `);
}

/**
 * Counts one failure of the claimed text and gives the claim up. The count
 * belongs to a digest: a failure of a different text than the one counted
 * starts over at one. Returns the count, or null when the claim was no longer
 * this worker's and nothing was written.
 */
export async function recordFailure(
  db: Database,
  table: CircuitTable,
  claim: ClaimedDocument
): Promise<number | null> {
  const result = await db.execute<{ translation_attempts: number }>(sql`
    UPDATE ${table}
       SET translation_attempts = CASE
             WHEN translation_attempt_digest = ${claim.textDigest}
             THEN translation_attempts + 1
             ELSE 1
           END,
           translation_attempt_digest = ${claim.textDigest},
           translation_claimed_at = NULL
     WHERE id = ${claim.id}
       AND translation_claimed_at = ${claim.claimedAt}::timestamptz
    RETURNING translation_attempts
  `);
  return result.rows[0]?.translation_attempts ?? null;
}

/** What a finished document is marked with. */
export interface TranslationResult {
  nameLanguage: string | null;
  descriptionLanguage: string | null;
  /** The machine rows; a language without one is simply absent. */
  texts: Partial<Record<Locale, TranslatedText>>;
  /** The served model of the call, or null when none was made. */
  model: string | null;
}

/**
 * Marks the document done for the text it had when it was claimed, and
 * replaces all its machine rows with `result.texts`, in one transaction.
 *
 * The digest guard is the whole defence against an edit made while the call
 * was in flight: the text the result describes is gone, so nothing is
 * written, the row is pending under its new digest, and false comes back.
 *
 * `requireHuman` names fields that are settled by their author's versions
 * alone; the guard then also requires one in every site language, checked in
 * the same statement so a version removed meanwhile is seen.
 */
export async function settleTranslation(
  db: Database,
  table: CircuitTable,
  claim: Pick<ClaimedDocument, 'id' | 'textDigest'>,
  result: TranslationResult,
  requireHuman: readonly ('name' | 'description')[] = []
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const humanGuards = requireHuman.map(
      (field) =>
        sql`AND ${authoredInEveryLocale(table, sql`${claim.id}`, field)}`
    );

    const settled = await tx.execute(sql`
      UPDATE ${table}
         SET name_language = ${result.nameLanguage},
             description_language = ${result.descriptionLanguage},
             translated_digest = ${claim.textDigest},
             translation_claimed_at = NULL
       WHERE id = ${claim.id}
         AND text_digest = ${claim.textDigest}
         ${sql.join(humanGuards, sql` `)}
      RETURNING id
    `);
    if (settled.rows.length === 0) return false;

    await replaceMachineTexts(tx, table, claim, result);
    return true;
  });
}

async function replaceMachineTexts(
  tx: Queryable,
  table: CircuitTable,
  claim: Pick<ClaimedDocument, 'id' | 'textDigest'>,
  result: TranslationResult
): Promise<void> {
  const texts = textTableOf(table);
  await tx.execute(sql`
    DELETE FROM ${texts}
     WHERE document_id = ${claim.id} AND origin = 'machine'
  `);

  const rows = Object.entries(result.texts).map(
    ([language, text]) => sql`(
      ${claim.id}, ${language}, 'machine'::document_text_origin,
      ${text.name}, ${text.description}, ${claim.textDigest}, ${result.model}
    )`
  );
  if (rows.length === 0) return;
  await tx.execute(sql`
    INSERT INTO ${texts}
           (document_id, language, origin, name, description, source_digest, model)
    VALUES ${sql.join(rows, sql`, `)}
  `);
}

/** Whether the author has written `field` of the document in every site language. */
function authoredInEveryLocale(
  table: CircuitTable,
  documentId: SQL,
  field: 'name' | 'description'
): SQL<boolean> {
  return sql<boolean>`(
    SELECT count(*) FROM ${textTableOf(table)} human
     WHERE human.document_id = ${documentId}
       AND human.origin = 'human'
       AND human.${sql.identifier(field)} IS NOT NULL
       AND human.language IN (${localeList()})
  ) = ${LOCALES.length}`;
}

function localeList(): SQL {
  return sql.join(
    LOCALES.map((locale) => sql`${locale}`),
    sql`, `
  );
}
