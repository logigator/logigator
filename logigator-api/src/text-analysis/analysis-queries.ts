import { sql } from 'drizzle-orm';
import type { Database } from '../database/database.module';
import { analysisPendingWhere } from '../database/schema';
import {
  type CircuitTable,
  linkResolvesFor
} from '../documents/circuit-queries';
import { outer, textTableOf } from '../documents/document-text-queries';
import type { DocumentTranslation } from '../translation/document-translation';
import { replaceMachineTexts } from '../translation/machine-texts';
import { ANALYSIS_LEASE_MINUTES } from './analysis-lease';

/**
 * The text analysis worker's statements. Each write is one statement guarded
 * by what it depends on — the claim it holds, or the text it analyzed — so no
 * column is ever computed from a value read in an earlier statement.
 *
 * A claim is identified by its `analysis_claimed_at`, carried as text: the
 * column holds microseconds, which a JavaScript `Date` would round away, and
 * then no guard on it would ever match.
 */

const LEASE = sql.raw(`interval '${ANALYSIS_LEASE_MINUTES} minutes'`);

/** One document the worker holds, with what it needs to analyze it. */
export interface ClaimedDocument {
  id: string;
  userId: string;
  name: string;
  description: string;
  textDigest: string;
  textLanguageHint: string | null;
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
  claimed_at: string;
}

/**
 * Takes up to `batch` pending documents of one kind, oldest edit first, in one
 * statement. `SKIP LOCKED` keeps two API instances from taking the same row,
 * and the lease brings a crashed worker's rows back.
 *
 * Pending is `analyzed_digest IS DISTINCT FROM text_digest`, so every write
 * path that changes the text makes the row pending again by itself. A private
 * or hidden document is never taken: it may not leave the database. An
 * unlisted empty one, with neither a component nor a wire, is passed by too:
 * nobody is shown it, and drawn on later it is taken from then, its text still
 * pending. A public empty one is taken like any other, since anybody can open
 * it and its text has to be judged. A text that failed
 * `MAX_ANALYSIS_ATTEMPTS` times is parked until its digest moves.
 *
 * The debounce covers the author's versions as well as the original: a version
 * written within it holds the document back as an edit does, so an author
 * writing one language after another is judged once, after the last. The edit
 * time is not moved for that, since listings order by it; a version's own
 * `created_at` is what is waited on. A removal leaves no time behind and is
 * taken on the next tick.
 */
export async function claimPending(
  db: Database,
  table: CircuitTable,
  options: { debounceSeconds: number; batch: number }
): Promise<ClaimedDocument[]> {
  // `RETURNING` follows the update's plan, not the subquery's order, so the
  // claimed rows are put back in edit order around it. The subquery starts
  // from the partial index's own predicate: the planner uses the index only
  // where it can prove the query's condition implies the index's, which the
  // predicate's literals let it do and a bound parameter would not.
  const result = await db.execute<ClaimedRow>(sql`
    WITH claimed AS (
      UPDATE ${table} SET analysis_claimed_at = now()
       WHERE id IN (
         SELECT id FROM ${table}
          WHERE ${analysisPendingWhere(table)}
            AND NOT (visibility = 'unlisted' AND component_count = 0 AND wire_count = 0)
            AND last_edited_at < now() - make_interval(secs => ${options.debounceSeconds})
            AND NOT EXISTS (
              SELECT 1 FROM ${textTableOf(table)} human
               WHERE human.document_id = ${outer(table.id)}
                 AND human.origin = 'human'
                 AND human.created_at >= now() - make_interval(secs => ${options.debounceSeconds}))
            AND (analysis_claimed_at IS NULL OR analysis_claimed_at < now() - ${LEASE})
          ORDER BY last_edited_at
          LIMIT ${options.batch}
          FOR UPDATE SKIP LOCKED)
      RETURNING id, user_id, name, description, text_digest, text_language_hint,
                analysis_claimed_at::text AS claimed_at, last_edited_at
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
    claimedAt: row.claimed_at
  }));
}

/**
 * Renews the claim right before its call, if the text may still be sent: the
 * document is neither private nor hidden, its text is the one claimed, and the
 * claim is still this worker's. Returns the renewed claim, or null when it may
 * not be sent.
 *
 * A batch is analyzed one document after another, so a document can be made
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
    UPDATE ${table} SET analysis_claimed_at = now()
     WHERE id = ${claim.id}
       AND ${linkResolvesFor(table, null)}
       AND text_digest = ${claim.textDigest}
       AND analysis_claimed_at = ${claim.claimedAt}::timestamptz
    RETURNING analysis_claimed_at::text AS claimed_at
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
    UPDATE ${table} SET analysis_claimed_at = NULL
     WHERE id = ${claim.id}
       AND analysis_claimed_at = ${claim.claimedAt}::timestamptz
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
    UPDATE ${table} SET analysis_claimed_at = ${claimedAt.toISOString()}::timestamptz
     WHERE id = ${claim.id}
       AND analysis_claimed_at = ${claim.claimedAt}::timestamptz
  `);
}

/**
 * Counts one failure of the claimed text and gives the claim up. The count
 * belongs to a digest: a failure of a different text than the one counted
 * starts over at one. Returns the count, or null when the claim was no longer
 * this worker's and nothing was written.
 *
 * `judged` is whether the failed call still gave a moderation verdict, a
 * refused translation's, which checks the claimed text in the same statement
 * (`text-check.ts`). The one a declined reply stands for is no verdict of the
 * text, and checks nothing. The digest written
 * is the claimed one: after an edit during the call it names a text that is
 * gone, which checks nothing.
 */
export async function recordFailure(
  db: Database,
  table: CircuitTable,
  claim: ClaimedDocument,
  judged: boolean
): Promise<number | null> {
  const result = await db.execute<{ analysis_attempts: number }>(sql`
    UPDATE ${table}
       SET analysis_attempts = CASE
             WHEN analysis_attempt_digest = ${claim.textDigest}
             THEN analysis_attempts + 1
             ELSE 1
           END,
           analysis_attempt_digest = ${claim.textDigest},
           ${judged ? sql`checked_digest = ${claim.textDigest},` : sql``}
           analysis_claimed_at = NULL
     WHERE id = ${claim.id}
       AND analysis_claimed_at = ${claim.claimedAt}::timestamptz
    RETURNING analysis_attempts
  `);
  return result.rows[0]?.analysis_attempts ?? null;
}

/**
 * Marks the document done for the text it had when it was claimed, with the
 * detected languages, and replaces all its machine rows with the
 * translation's, in one transaction. A settled call always gave a moderation
 * verdict, so the same statement checks the text (`text-check.ts`).
 *
 * Two guards stand against what changed while the call was in flight, and
 * either one writes nothing, leaves the row pending and returns false. The
 * digest: an edit of the original moved it, and the text the result describes
 * is gone. The claim: an author's version written or removed meanwhile gave it
 * up, since the call judged versions that are no longer the document's; the
 * write that did so is also what made the row pending.
 */
export async function settleAnalysis(
  db: Database,
  table: CircuitTable,
  claim: Pick<ClaimedDocument, 'id' | 'textDigest' | 'claimedAt'>,
  translation: DocumentTranslation,
  model: string | null
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const settled = await tx.execute(sql`
      UPDATE ${table}
         SET name_language = ${translation.nameLanguage},
             description_language = ${translation.descriptionLanguage},
             analyzed_digest = ${claim.textDigest},
             checked_digest = ${claim.textDigest},
             analysis_claimed_at = NULL
       WHERE id = ${claim.id}
         AND text_digest = ${claim.textDigest}
         AND analysis_claimed_at = ${claim.claimedAt}::timestamptz
      RETURNING id
    `);
    if (settled.rows.length === 0) return false;

    await replaceMachineTexts(tx, table, {
      documentId: claim.id,
      sourceDigest: claim.textDigest,
      texts: translation.texts,
      model
    });
    return true;
  });
}
