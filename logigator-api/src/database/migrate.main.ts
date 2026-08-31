/* Entry point of the `migrate.js` bundle: applies pending migrations and exits.

   A second Rspack entry rather than a script behind a TypeScript loader, so the
   deployed image can run it with plain `node`.

   eslint-disable no-console: a CLI whose only output channel is the terminal,
   and Nest's logger is never bootstrapped in this entry point. */
/* eslint-disable no-console */
import { join } from 'node:path';
import { loadEnv } from '../config/env';
import { runMigrations } from './migrate';

const env = loadEnv(process.env);

// The deploy layout ships `drizzle/` beside `migrate.js`. In the repository the
// migrations sit in the package, so `db:migrate` passes that path explicitly.
const migrationsFolder =
  process.argv[2] ?? join(import.meta.dirname, 'drizzle');

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
