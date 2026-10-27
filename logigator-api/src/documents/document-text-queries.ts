import {
  and,
  eq,
  getColumnTable,
  getTableName,
  inArray,
  sql,
  type Column,
  type SQL
} from 'drizzle-orm';
import type {
  DocumentTextVersion,
  PutDocumentTextRequest
} from '@logigator/contract';
import type { LanguageId } from '@logigator/core';
import type { Queryable } from '../database/database.module';
import {
  componentTexts,
  components,
  projectTexts,
  projects
} from '../database/schema';
import type { CircuitTable } from './circuit-queries';
import type { TextField } from './document-texts';

/** Either text table, beside the document table it belongs to. */
export type TextTable = typeof projectTexts | typeof componentTexts;

export function textTableOf(table: typeof projects): typeof projectTexts;
export function textTableOf(table: typeof components): typeof componentTexts;
export function textTableOf(table: CircuitTable): TextTable;
export function textTableOf(table: CircuitTable): TextTable {
  return table === projects ? projectTexts : componentTexts;
}

/**
 * An outer column spelled with its table, for a correlated subquery. The
 * builder renders a column unqualified in the select list of a single-table
 * query, and inside a subquery over a text table a bare name could bind to a
 * column of that table instead.
 */
function outer(column: Column): SQL {
  return sql`${sql.identifier(getTableName(getColumnTable(column)))}.${sql.identifier(column.name)}`;
}

/**
 * The join condition that puts the text of one origin in `language` beside
 * each document row. A left join: most documents have none, and the row is
 * still read. A machine row is joined whatever text it was written for; the
 * resolution compares its digest.
 */
export function textOn(
  text: {
    documentId: Column;
    language: Column;
    origin: Column;
  },
  documentId: Column,
  language: LanguageId,
  origin: 'human' | 'machine'
): SQL | undefined {
  return and(
    eq(text.documentId, documentId),
    eq(text.language, language),
    eq(text.origin, origin)
  );
}

/**
 * Whether a machine translation of `field` into `language` exists for the
 * document's current text. The digest is compared here, so a row written for an
 * older text reads as absent; a row whose field is null, where the translator
 * kept the text as it is, does too.
 */
export function machineTextFor(
  table: CircuitTable,
  field: TextField,
  language: LanguageId
): SQL<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${textTableOf(table)} machine
     WHERE machine.document_id = ${outer(table.id)}
       AND machine.language = ${language}
       AND machine.origin = 'machine'
       AND machine.source_digest = ${outer(table.textDigest)}
       AND machine.${sql.identifier(field)} IS NOT NULL
  )`;
}

/**
 * A name search over the original and every human version, in any language:
 * a reader searching for a document's German name on the English site finds
 * it, and is shown the English name. Machine text is never searched; it is
 * never shown where the search matched it.
 *
 * Written out as SQL for the reason `linkResolvesFor` is: drizzle's `or()` is
 * typed `SQL | undefined`, and inside the caller's `and()` an `undefined` would
 * drop the clause silently.
 */
export function nameOrHumanNameMatches(
  table: CircuitTable,
  pattern: string
): SQL {
  return sql`(${table.name} ILIKE ${pattern} OR EXISTS (
    SELECT 1 FROM ${textTableOf(table)} human
     WHERE human.document_id = ${outer(table.id)}
       AND human.origin = 'human'
       AND human.name ILIKE ${pattern}
  ))`;
}

/**
 * The author's versions of each listed document, for its owner: one statement
 * for the whole page. `stale` is computed against the document's digest in the
 * same statement, so it describes the text the row now holds.
 */
export async function humanVersionsOf(
  db: Queryable,
  table: CircuitTable,
  ids: readonly string[]
): Promise<Map<string, DocumentTextVersion[]>> {
  const versions = new Map<string, DocumentTextVersion[]>();
  if (ids.length === 0) return versions;

  const texts = textTableOf(table);
  const rows = await db
    .select({
      documentId: texts.documentId,
      language: texts.language,
      name: texts.name,
      description: texts.description,
      stale: sql<boolean>`${texts.sourceDigest} <> ${table.textDigest}`
    })
    .from(texts)
    .innerJoin(table, eq(table.id, texts.documentId))
    .where(and(inArray(texts.documentId, [...ids]), eq(texts.origin, 'human')))
    .orderBy(texts.language);

  for (const row of rows) {
    const list = versions.get(row.documentId) ?? [];
    list.push({
      // Written only through a site-language path parameter or the seed.
      language: row.language as LanguageId,
      name: row.name,
      description: row.description,
      stale: row.stale
    });
    versions.set(row.documentId, list);
  }
  return versions;
}

/**
 * Sends the document back to the text analysis worker after a write to its
 * author's versions. Those are shown to readers and judged with the original
 * in one call, and a version moves no `text_digest`, so the write makes the
 * document pending itself. It also gives up a claim in flight, whose result
 * would judge versions that are gone, and a worker's hold, which the next
 * claim sets again where it still applies. The claim's debounce waits on the
 * version's own write time.
 *
 * Until the new call lands, the original's detected languages read as unknown,
 * since they count only while `analyzed_digest` is the current digest: a
 * reader is shown no language and no machine translation for the debounce and
 * the call. The machine rows themselves stay until the call replaces them.
 *
 * Everything else keyed on the text is reset with it, as an edit of the
 * original moves the digest past it. A version is shown to readers in place of
 * the original, so the check and a moderator's clearance go, and a public
 * document leaves the listings until the new call has given its verdict
 * (`text-check.ts`). The failure count goes too, so a parked text is taken
 * again.
 */
const REJUDGE = sql`analyzed_digest = NULL, checked_digest = NULL, moderated_digest = NULL,
  analysis_claimed_at = NULL, analysis_attempts = 0`;

/**
 * Writes the author's version in one language, replacing any before it whole.
 * Returns whether a row was written: nothing is when the document is not the
 * owner's or does not exist.
 *
 * One statement, so `source_digest` is the digest of the text the document
 * holds at the moment of the write: read a statement earlier, an edit landing
 * between the two would leave a fresh version marked as written for the older
 * text, or a stale one marked as current.
 *
 * The same statement sends the document to be judged again ({@link REJUDGE}).
 *
 * Neither `version` nor `last_edited_at` moves. The version is not snapshot
 * content, and the edit time is when the original last changed.
 */
export async function putHumanText(
  db: Queryable,
  table: CircuitTable,
  ownerId: string,
  id: string,
  language: LanguageId,
  body: PutDocumentTextRequest
): Promise<boolean> {
  const result = await db.execute<{ document_id: string }>(sql`
    WITH written AS (
      INSERT INTO ${textTableOf(table)}
             (document_id, language, origin, name, description, source_digest)
      SELECT ${table.id}, ${language}, 'human'::document_text_origin,
             ${body.name ?? null}, ${body.description ?? null}, ${table.textDigest}
        FROM ${table}
       WHERE ${table.id} = ${id} AND ${table.userId} = ${ownerId}
      ON CONFLICT (document_id, language, origin) DO UPDATE
         SET name = excluded.name,
             description = excluded.description,
             source_digest = excluded.source_digest,
             created_at = now()
      RETURNING document_id
    ), rejudged AS (
      UPDATE ${table} SET ${REJUDGE}
       WHERE id IN (SELECT document_id FROM written)
    )
    SELECT document_id FROM written
  `);
  return result.rows.length > 0;
}

/**
 * Removes the author's version in one language. Ownership is in the statement,
 * as it is for every owner write. A machine row of the same language stays,
 * and readers fall back to the original with it once the document is judged
 * again, which the same statement asks for ({@link REJUDGE}).
 */
export async function deleteHumanText(
  db: Queryable,
  table: CircuitTable,
  ownerId: string,
  id: string,
  language: LanguageId
): Promise<void> {
  const texts = textTableOf(table);
  await db.execute(sql`
    WITH removed AS (
      DELETE FROM ${texts}
       USING ${table}
       WHERE ${texts.documentId} = ${table.id}
         AND ${table.id} = ${id}
         AND ${table.userId} = ${ownerId}
         AND ${texts.language} = ${language}
         AND ${texts.origin} = 'human'
      RETURNING ${texts.documentId}
    )
    UPDATE ${table} SET ${REJUDGE}
     WHERE id IN (SELECT document_id FROM removed)
  `);
}

/**
 * Copies every text of one document, human and machine, onto another of the
 * same kind. Each row keeps its `source_digest`: the copy holds the same name
 * and description, so its generated digest is the same, and whatever was
 * current for the source is current for the copy.
 */
export async function copyTexts(
  db: Queryable,
  table: CircuitTable,
  sourceId: string,
  copyId: string
): Promise<void> {
  const texts = textTableOf(table);
  await db.execute(sql`
    INSERT INTO ${texts}
           (document_id, language, origin, name, description, source_digest, model, created_at)
    SELECT ${copyId}, language, origin, name, description, source_digest, model, created_at
      FROM ${texts}
     WHERE ${texts.documentId} = ${sourceId}
  `);
}
