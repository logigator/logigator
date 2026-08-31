import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';
import type { CurrentCircuitFile } from '@logigator/core';
import { users } from './users';

/**
 * Columns every stored circuit has, as a factory rather than a shared object:
 * column builders are stateful, so two tables must never be handed the same
 * instances.
 *
 * `document` is the single source of truth; everything derived from it — the
 * dependency edges, the counts below — is a rebuildable cache, which is what
 * makes the re-extract command safe to run at any time.
 */
function circuitColumns() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 20 }).notNull(),
    description: varchar('description', { length: 2048 }).notNull().default(''),
    /**
     * The native versioned document, always at the newest format version:
     * writes are normalized before they are stored. Reads still pass through
     * `migrateToCurrent` as a safety net for a crashed bulk re-normalization.
     */
    document: jsonb('document').$type<CurrentCircuitFile>().notNull(),
    /**
     * Denormalized out of the JSON so the re-normalization job that follows a
     * format bump finds its work with an indexed scan.
     */
    formatVersion: integer('format_version').notNull(),
    /**
     * Optimistic-concurrency counter, bumped on every user-visible edit. For
     * components it is also the stamp a placed snapshot is compared against to
     * offer an update. Re-normalization does not bump it: rewriting an encoding
     * is not an edit.
     */
    version: integer('version').notNull().default(1),
    componentCount: integer('component_count').notNull().default(0),
    wireCount: integer('wire_count').notNull().default(0),
    /** Share-link token; migrated rows keep theirs, so old share URLs work. */
    link: uuid('link').notNull().defaultRandom().unique(),
    public: boolean('public').notNull().default(false),
    /**
     * Id of the preview's directory on the served volume; the renders stay
     * files behind a cache-friendly `<img>` path. One pointer for both themes,
     * since the editor uploads the light and dark variant together and they are
     * replaced together.
     */
    previewId: uuid('preview_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  };
}

/** A board: a circuit that is opened and simulated, never embedded in another. */
export const projects = pgTable(
  'projects',
  {
    ...circuitColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    forkedFromId: uuid('forked_from_id').references(
      (): AnyPgColumn => projects.id,
      { onDelete: 'set null' }
    )
  },
  (t) => [
    index('projects_user_idx').on(t.userId),
    index('projects_format_version_idx').on(t.formatVersion),
    index('projects_public_idx').on(t.public, t.lastEditedAt),
    index('projects_forked_from_idx').on(t.forkedFromId)
  ]
);

/**
 * A library component: a circuit that is placed inside other circuits. The
 * extra columns are what a placed instance needs to render without loading the
 * document — symbol, port counts and port labels.
 */
export const components = pgTable(
  'components',
  {
    ...circuitColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    forkedFromId: uuid('forked_from_id').references(
      (): AnyPgColumn => components.id,
      { onDelete: 'set null' }
    ),
    symbol: varchar('symbol', { length: 5 }).notNull(),
    numInputs: integer('num_inputs').notNull().default(0),
    numOutputs: integer('num_outputs').notNull().default(0),
    labels: text('labels').array().notNull().default([])
  },
  (t) => [
    index('components_user_idx').on(t.userId),
    index('components_format_version_idx').on(t.formatVersion),
    index('components_public_idx').on(t.public, t.lastEditedAt),
    index('components_forked_from_idx').on(t.forkedFromId)
  ]
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ComponentRow = typeof components.$inferSelect;
export type NewComponentRow = typeof components.$inferInsert;
