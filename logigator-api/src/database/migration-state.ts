import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import type { Queryable } from './database.module';
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './migrate';

/** A migration reduced to what identifies it: its folder name and its SQL. */
export interface MigrationRef {
  name: string;
  /** sha256 of `migration.sql`, the digest drizzle's migrator records. */
  hash: string;
}

/** Every way a database can fail to be the one a build was written against. */
export interface MigrationDrift {
  /** Checked in, never applied: the database is behind this build. */
  pending: string[];
  /** Applied, not checked in: the database is ahead of this build. */
  unknown: string[];
  /** Applied under a name whose migration file has changed since. */
  diverged: string[];
}

/**
 * The migrations this build carries, in the order they are applied.
 *
 * Read through drizzle's own reader, so the digest compared below is the one
 * the migrator stores and the two cannot drift. An empty or missing folder is a
 * broken artifact and fails here: read as "nothing expected", it would let
 * every schema pass as current.
 */
export function readLocalMigrations(migrationsFolder: string): MigrationRef[] {
  const migrations = readMigrationFiles({ migrationsFolder }).map(
    ({ name, hash }) => ({ name, hash })
  );

  if (migrations.length === 0) {
    throw new Error(
      `No migrations found in ${migrationsFolder}. The folder ships beside the bundle; without it the schema cannot be checked.`
    );
  }

  return migrations;
}

/**
 * What drizzle's migrator has recorded. A missing ledger table reads as nothing
 * applied — a database that has never been migrated is behind by every
 * migration — so the check never creates the table the runner owns.
 */
export async function readAppliedMigrations(
  db: Queryable
): Promise<MigrationRef[]> {
  const ledger = `${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`;
  const probe = await db.execute<{ present: boolean }>(
    // Cast so the parameter's type is resolved at parse time rather than left
    // to the single candidate signature.
    sql`select to_regclass(${ledger}::text) is not null as present`
  );
  if (!probe.rows[0]?.present) return [];

  const applied = await db.execute<{ name: string | null; hash: string }>(sql`
    select name, hash
      from ${sql.identifier(MIGRATIONS_SCHEMA)}.${sql.identifier(MIGRATIONS_TABLE)}
  `);

  // A nameless row predates the named ledger, so nothing identifies which
  // migration it was. Dropping it reports that migration as pending, which
  // errs towards refusing to boot rather than towards trusting the schema.
  return applied.rows.flatMap((row) =>
    row.name === null ? [] : [{ name: row.name, hash: row.hash }]
  );
}

/** Matches applied migrations against checked-in ones, both ways round. */
export function compareMigrations(
  local: MigrationRef[],
  applied: MigrationRef[]
): MigrationDrift {
  const appliedHashes = new Map(applied.map(({ name, hash }) => [name, hash]));
  const localNames = new Set(local.map(({ name }) => name));

  const pending: string[] = [];
  const diverged: string[] = [];
  for (const migration of local) {
    const appliedHash = appliedHashes.get(migration.name);
    if (appliedHash === undefined) pending.push(migration.name);
    else if (appliedHash !== migration.hash) diverged.push(migration.name);
  }

  return {
    pending,
    unknown: applied
      .filter(({ name }) => !localNames.has(name))
      .map(({ name }) => name)
      .sort(),
    diverged
  };
}

export function isAligned(drift: MigrationDrift): boolean {
  return Object.values(drift).every((names) => names.length === 0);
}

/** Each kind of drift, with the headline and the way out that belongs to it. */
const KINDS: readonly {
  kind: keyof MigrationDrift;
  headline: string;
  remedy: string;
}[] = [
  {
    kind: 'pending',
    headline:
      'checked in but never applied — the database is behind this build',
    remedy:
      'Apply them: `node migrate.js` beside the bundle, `yarn workspace logigator-api run db:migrate` in the repository.'
  },
  {
    kind: 'unknown',
    headline:
      'applied but not checked in — the database is ahead of this build',
    remedy:
      'Deploy the build they came from: there are no down migrations to walk the schema back.'
  },
  {
    kind: 'diverged',
    headline: 'applied under a name whose migration file has changed since',
    remedy:
      'Restore the file and express the change as a new migration — an applied migration is history.'
  }
];

/**
 * Every problem at once, in the shape a boot failure is read in: the migrations
 * by name, then what to do about them.
 */
export function describeMigrationDrift(drift: MigrationDrift): string {
  const reported = KINDS.filter(({ kind }) => drift[kind].length > 0);

  return [
    'The database schema is not the one this build expects.',
    ...reported.map(({ kind, headline, remedy }) =>
      [
        `${drift[kind].length} migration(s) ${headline}:`,
        ...drift[kind].map((name) => `  ${name}`),
        `  → ${remedy}`
      ].join('\n')
    ),
    "DATABASE_MIGRATION_CHECK=false boots anyway, on the operator's word that the schema is compatible."
  ].join('\n\n');
}

/**
 * Proves the database carries exactly the migrations this build does.
 *
 * @returns the newest migration, for the boot log.
 * @throws naming every migration that does not line up.
 */
export async function assertMigrationsAligned(
  db: Queryable,
  migrationsFolder: string
): Promise<string> {
  const local = readLocalMigrations(migrationsFolder);
  const drift = compareMigrations(local, await readAppliedMigrations(db));

  if (!isAligned(drift)) throw new Error(describeMigrationDrift(drift));

  return local[local.length - 1].name;
}
