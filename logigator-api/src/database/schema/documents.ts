import {
  index,
  integer,
  jsonb,
  pgEnum,
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
 * How far a document's link reaches: the contract's three states, as a type of
 * the database's own.
 *
 * An enum rather than a varchar with a check constraint. The value list is
 * written out once, in the DDL the migration is generated from, and the type
 * *is* the constraint — nothing else can be stored, by any writer. A check on a
 * varchar states the same set a second time, as a rule about text, and leaves
 * the column reading as free text with a constraint attached.
 *
 * At module scope rather than inside {@link circuitColumns}, unlike the columns
 * themselves: an enum is a named type in the schema, so a second one of the
 * same name is an error. The column *builder* is still created per call, which
 * is what that factory is for.
 *
 * The other definition of this set is `documentVisibilitySchema` in
 * `@logigator/contract`, which validates what a request carries. A fourth state
 * is a change to both, and the migration is where the cost of one lands — the
 * column below says what that cost is.
 */
export const documentVisibility = pgEnum('document_visibility', [
  'private',
  'unlisted',
  'public'
]);

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
    /**
     * Share-link token; migrated rows keep theirs, so old share URLs work.
     * Only an explicit regeneration mints a new one — a visibility change never
     * writes this column, so a document that is withdrawn and shared again is
     * still at the address its owner handed out.
     */
    link: uuid('link').notNull().defaultRandom().unique(),
    /**
     * How far this document's link reaches, which decides both what `link`
     * resolves to and whether the document is listed. Defaulted to `unlisted`,
     * not `private`: a document created by a client that names no state keeps a
     * link that resolves, which is what the boolean's `false` did.
     *
     * The one thing the enum costs is extending it. `ALTER TYPE … ADD VALUE`
     * cannot *use* the value in the transaction that adds it, and migrations
     * here run inside a single transaction, so a fourth state arrives in a
     * migration of its own, with whatever uses it in the next. Retiring a state
     * is heavier still — there is no `DROP VALUE`, so the type is swapped for
     * one without it and every column re-pointed. Three states that name a
     * visibility have no reason to churn, which is what makes that a fair trade
     * for the type saying what it holds.
     */
    visibility: documentVisibility('visibility').notNull().default('unlisted'),
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
    // The community listings and the profile counts both read
    // `visibility = 'public'` down the edit time, so the state stays the
    // leading column.
    index('projects_visibility_idx').on(t.visibility, t.lastEditedAt),
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
    index('components_visibility_idx').on(t.visibility, t.lastEditedAt),
    index('components_forked_from_idx').on(t.forkedFromId)
  ]
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ComponentRow = typeof components.$inferSelect;
export type NewComponentRow = typeof components.$inferInsert;
