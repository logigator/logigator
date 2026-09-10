/* Entry point of the `migrate.js` bundle: applies pending migrations and exits.

   A second Rspack entry rather than a script behind a TypeScript loader, so the
   deployed image can run it with plain `node`.

   eslint-disable no-console: a CLI whose only output channel is the terminal,
   and Nest's logger is never bootstrapped in this entry point. */
/* eslint-disable no-console */
import { loadEnv } from '../config/env';
import { defaultMigrationsFolder, runMigrations } from './migrate';

const env = loadEnv(process.env);

// The same folder the server checks its schema against — the build copies
// `drizzle/` beside every entry point, so the runner and the gate cannot be
// pointed at different sets of migrations.
const migrationsFolder = defaultMigrationsFolder();

runMigrations(env.DATABASE_URL, migrationsFolder).then(
  () => {
    console.log(`Migrations applied from ${migrationsFolder}`);
    process.exit(0);
  },
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
