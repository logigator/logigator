/* Entry point of the `migrate.js` bundle: applies pending migrations and exits.
   With `--backup-dir=<dir>`, it first dumps the database there when a migration
   is pending, deleting every earlier dump; it needs `pg_dump` on the PATH.

   A second Rspack entry rather than a script behind a TypeScript loader, so the
   deployed image can run it with plain `node`.

   eslint-disable no-console: a CLI whose only output channel is the terminal,
   and Nest's logger is never bootstrapped in this entry point. */
/* eslint-disable no-console */
import { parseArgs } from 'node:util';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import manifest from '../../../package.json';
import { loadEnv } from '../config/env';
import { pgDump, replaceDump } from './backup';
import { defaultMigrationsFolder, runMigrations } from './migrate';
import {
  compareMigrations,
  readAppliedMigrations,
  readLocalMigrations
} from './migration-state';
import { relations } from './schema';

const env = loadEnv(process.env);
const { values: args } = parseArgs({
  options: { 'backup-dir': { type: 'string' } }
});

// The same folder the server checks its schema against — the build copies
// `drizzle/` beside every entry point, so the runner and the gate cannot be
// pointed at different sets of migrations.
const migrationsFolder = defaultMigrationsFolder();

async function pendingMigrations(): Promise<string[]> {
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  try {
    const applied = await readAppliedMigrations(
      drizzle({ client: pool, relations })
    );
    return compareMigrations(readLocalMigrations(migrationsFolder), applied)
      .pending;
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const backupDir = args['backup-dir'];
  if (backupDir !== undefined) {
    const pending = await pendingMigrations();
    if (pending.length > 0) {
      // 20261027T120939Z: sorts by time and needs no quoting in a shell.
      const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
      const dump = await replaceDump(
        backupDir,
        `before-${manifest.version}-${stamp}.dump`,
        (file) => pgDump(env.DATABASE_URL, file)
      );
      console.log(
        `Dumped the database to ${dump} before ${pending.length} migration(s)`
      );
    }
  }

  await runMigrations(env.DATABASE_URL, migrationsFolder);
  console.log(`Migrations applied from ${migrationsFolder}`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
