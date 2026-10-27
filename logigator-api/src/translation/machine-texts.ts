import { sql } from 'drizzle-orm';
import type { Locale } from '../common/locale';
import type { Queryable } from '../database/database.module';
import type { CircuitTable } from '../documents/circuit-queries';
import { textTableOf } from '../documents/document-text-queries';
import type { TranslatedText } from '../documents/document-texts';

/** One document's machine texts, as one call made them. */
export interface MachineTexts {
  documentId: string;
  /** The `textDigest` the texts were translated from. */
  sourceDigest: string;
  /** The machine rows; a language without one is simply absent. */
  texts: Partial<Record<Locale, TranslatedText>>;
  /** The served model of the call, or null where OpenRouter left it out. */
  model: string | null;
}

/**
 * Replaces all of a document's machine rows with `machine.texts`. Meant for
 * the transaction that marks the text they were made for as done, so a read
 * never sees the mark without the rows or the rows of another text.
 */
export async function replaceMachineTexts(
  tx: Queryable,
  table: CircuitTable,
  machine: MachineTexts
): Promise<void> {
  const texts = textTableOf(table);
  await tx.execute(sql`
    DELETE FROM ${texts}
     WHERE document_id = ${machine.documentId} AND origin = 'machine'
  `);

  const rows = Object.entries(machine.texts).map(
    ([language, text]) => sql`(
      ${machine.documentId}, ${language}, 'machine'::document_text_origin,
      ${text.name}, ${text.description}, ${machine.sourceDigest}, ${machine.model}
    )`
  );
  if (rows.length === 0) return;
  await tx.execute(sql`
    INSERT INTO ${texts}
           (document_id, language, origin, name, description, source_digest, model)
    VALUES ${sql.join(rows, sql`, `)}
  `);
}
