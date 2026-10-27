import {
  char,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { components, projects } from './documents';

/**
 * Who wrote a document text: its author, naming the language, or the text
 * analysis worker. At module scope for the reason `documentVisibility` is.
 */
export const documentTextOrigin = pgEnum('document_text_origin', [
  'human',
  'machine'
]);

/**
 * The longest description a text row holds: twice what an author may write.
 * A translation runs longer than its original, German by a fifth or more, so a
 * description written up to the author's limit has to fit translated. An
 * author's own version is held to the author's limit by the request schema.
 */
export const TRANSLATED_DESCRIPTION_LENGTH = 4096;

function documentTextColumns() {
  return {
    language: varchar('language', { length: 8 }).notNull(),
    origin: documentTextOrigin('origin').notNull(),
    /** Null: no text for this field in this language; the original stands. */
    name: varchar('name', { length: 20 }),
    description: varchar('description', {
      length: TRANSLATED_DESCRIPTION_LENGTH
    }),
    sourceDigest: char('source_digest', { length: 32 }).notNull(),
    /** The model that served a machine row, as the response named it. */
    model: varchar('model', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  };
}

/**
 * A document's name and description in one more language, beside the original
 * in the document's own columns. Two tables, like the documents themselves, so
 * the foreign key is real and the texts go with their document.
 *
 * The key includes `origin`, so an author's version and a machine translation
 * of the same language coexist: a reader is served per field, and removing the
 * author's version falls back to the machine row without another call.
 *
 * `sourceDigest` is the document's `textDigest` the row was written against. A
 * machine row is served only while the two are equal, so an edit to the
 * original withdraws its translations on its own. A human row stays served
 * after an edit; the mismatch is only what tells its author it is stale.
 *
 * None of this is snapshot content: a placed component carries its original
 * name, so writing these rows bumps no `version` and leaves `lastEditedAt`
 * alone.
 */
export const projectTexts = pgTable(
  'project_texts',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    ...documentTextColumns()
  },
  (t) => [primaryKey({ columns: [t.documentId, t.language, t.origin] })]
);

export const componentTexts = pgTable(
  'component_texts',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    ...documentTextColumns()
  },
  (t) => [primaryKey({ columns: [t.documentId, t.language, t.origin] })]
);

export type ProjectTextRow = typeof projectTexts.$inferSelect;
export type NewProjectTextRow = typeof projectTexts.$inferInsert;
export type ComponentTextRow = typeof componentTexts.$inferSelect;
export type NewComponentTextRow = typeof componentTexts.$inferInsert;
