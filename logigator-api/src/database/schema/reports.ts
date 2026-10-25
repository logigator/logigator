import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from './users';

/** Which table a report's `document_id` names. */
export const documentKind = pgEnum('document_kind', ['project', 'component']);

/**
 * Why a document was reported: the contract's `documentReportReasonSchema`, as
 * a type of the database's own. A new reason is a change to both and a
 * migration of its own, for the reason `documentVisibility` gives.
 */
export const reportReason = pgEnum('report_reason', [
  'illegal',
  'copyright',
  'personal_data',
  'harassment',
  'spam',
  'other'
]);

/**
 * A notice about a document, from anybody who could open it. Kept as a record
 * of what was reported and when, so the document is named by kind and id
 * without a foreign key: deleting the document leaves the notice standing.
 *
 * A report is open until the moderation CLI resolves it; hiding the document
 * resolves every open report about it.
 */
export const documentReports = pgTable(
  'document_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentKind: documentKind('document_kind').notNull(),
    documentId: uuid('document_id').notNull(),
    reason: reportReason('reason').notNull(),
    explanation: varchar('explanation', { length: 2000 }).notNull(),
    /** An address the reporter gave for a reply; never shown to anybody. */
    contactEmail: varchar('contact_email', { length: 254 }),
    reporterId: uuid('reporter_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** What was done about it, written when it is resolved. */
    resolution: varchar('resolution', { length: 500 })
  },
  (t) => [
    index('document_reports_document_idx').on(t.documentKind, t.documentId)
  ]
);

export type DocumentReportRow = typeof documentReports.$inferSelect;
