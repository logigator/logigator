import { sql, type Column, type SQL } from 'drizzle-orm';

/**
 * Renames the stored document in place, inside the statement that writes the
 * column. Writing back a document read a moment earlier would overwrite a save
 * that landed in between — undetectably, since the rename's own version bump
 * lands on top of the save's. `jsonb_set` never sees a stale document.
 */
export function renameInDocument(document: Column, name: string): SQL {
  return sql`jsonb_set(${document}, '{name}', to_jsonb(${name}::text))`;
}
