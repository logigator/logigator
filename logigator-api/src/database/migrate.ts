import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Applies every pending migration in `migrationsFolder`, then closes its own
 * connection.
 *
 * Migrations are applied by the application's own runtime, not by `drizzle-kit`
 * — a development dependency the deployed bundle does not have. The E2E harness
 * calls this too, so the schema the specs run on is the one a deploy produces.
 *
 * The folder is a parameter because its location differs between the repository
 * and the deployed bundle.
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string
): Promise<void> {
  // Migrations run in a single transaction, and this process is short-lived.
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
