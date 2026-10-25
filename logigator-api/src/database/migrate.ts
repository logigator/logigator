import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Where drizzle's migrator records what it has applied. Its own defaults, named
 * here and passed in explicitly, so the startup check reads the very table the
 * runner writes rather than a second guess at the default.
 */
export const MIGRATIONS_SCHEMA = 'drizzle';
export const MIGRATIONS_TABLE = '__drizzle_migrations';

/**
 * The checked-in migrations, as the running process sees them: `drizzle/` is
 * copied next to the bundle, so the server, the migration runner and the
 * re-normalizer all resolve the same folder. Specs run from source instead and
 * override the {@link MIGRATIONS_FOLDER} provider.
 */
export function defaultMigrationsFolder(): string {
  return join(import.meta.dirname, 'drizzle');
}

/**
 * Applies every pending migration in `migrationsFolder`, then closes its own
 * connection.
 *
 * Migrations are applied by the application's own runtime, not by `drizzle-kit`
 * — a development dependency the deployed bundle does not have. The E2E harness
 * calls this too, so the schema the specs run on is the one a deploy produces.
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string
): Promise<void> {
  // Migrations run in a single transaction, and this process is short-lived.
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE
    });
  } finally {
    await pool.end();
  }
}
