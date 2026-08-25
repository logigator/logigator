import { sql, type Column, type SQL } from 'drizzle-orm';

/**
 * Renames the stored document in place, as part of the same statement that writes
 * the column.
 *
 * The document carries a copy of its name, and the column is the one place a name
 * is set — so a rename has to write both. Doing that from a value read a moment
 * earlier would mean a save landing in between is overwritten with the document
 * as it looked before it: a lost edit that nothing detects, since the rename's own
 * version bump lands on top of the save's. `jsonb_set` never sees a stale
 * document, so whatever the circuit is when the statement runs is the circuit that
 * gets the new name.
 */
export function renameInDocument(document: Column, name: string): SQL {
  return sql`jsonb_set(${document}, '{name}', to_jsonb(${name}::text))`;
}
