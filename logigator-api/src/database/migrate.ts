import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Applies every pending migration in `migrationsFolder`, then closes its own
 * connection.
 *
 * Migrations are applied by the application's own runtime, not by `drizzle-kit`:
 * kit is a development dependency and the deployed artifact is a bundle, so a
 * release runs this (as `migrate.js`, a second bundle entry point) before
 * starting the server. The E2E harness calls it directly against its throwaway
 * database, which is what keeps the schema the specs run on identical to the
 * schema a deploy produces.
 *
 * The folder is a parameter rather than resolved here: its location differs
 * between the repository and the deployed bundle, and a caller always knows
 * which one it is in.
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string
): Promise<void> {
  // One connection: migrations run in a single transaction anyway, and this is a
  // short-lived process.
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
