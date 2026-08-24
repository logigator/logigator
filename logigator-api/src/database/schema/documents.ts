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
 * The `document` column is the single source of truth. Everything derived from
 * it — the dependency edges, the counts below — is a rebuildable cache, which is
 * what makes the admin re-extract command safe to run at any time.
 */
function circuitColumns() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 20 }).notNull(),
    description: varchar('description', { length: 2048 }).notNull().default(''),
    /**
     * The native versioned document, always at the newest format version:
     * writes are normalized before they are stored, so the table only ever
     * holds one version. Reads still pass through `migrateToCurrent`, which is
     * a version check on a current row — a safety net for a crashed bulk
     * re-normalization, not the strategy.
     */
    document: jsonb('document').$type<CurrentCircuitFile>().notNull(),
    /**
     * The document's format version, denormalized out of the JSON so the bulk
     * re-normalization job that follows a format bump can find its work with an
     * indexed `WHERE format_version < current` scan.
     */
    formatVersion: integer('format_version').notNull(),
    /**
     * Optimistic-concurrency counter, bumped on every user-visible edit. It
     * replaces the legacy MD5 `oldHash` handshake, and for components it is
     * also the stamp a placed snapshot is compared against to offer an update.
     * The format re-normalization job deliberately does not bump it: rewriting
     * an encoding is not an edit.
     */
    version: integer('version').notNull().default(1),
    componentCount: integer('component_count').notNull().default(0),
    wireCount: integer('wire_count').notNull().default(0),
    /** Share-link token. Migrated rows keep their existing value so old share URLs keep working. */
    link: uuid('link').notNull().defaultRandom().unique(),
    public: boolean('public').notNull().default(false),
    /**
     * Id of the preview's directory on the served volume. Regenerable renders
     * with a cache-friendly `<img>` read path, so they stay files and the row
     * holds only the pointer.
     *
     * One pointer for both themes: the editor renders the light and the dark
     * variant in one pass and uploads them together, so they are replaced
     * together and there is nothing for a second column to point at
     * independently.
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
