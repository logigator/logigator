/* Entry point of the `migrate.js` bundle: applies pending migrations and exits.

   It is a second Rspack entry rather than a script run through a TypeScript
   loader, so migrating uses exactly the toolchain the server already needs — no
   extra dev dependency, and the deployed image can run it with plain `node`.

   eslint-disable no-console: this is a CLI whose only output channel is the
   terminal, and Nest's logger is never bootstrapped in this entry point. */
/* eslint-disable no-console */
import { join } from 'node:path';
import { loadEnv } from '../config/env';
import { runMigrations } from './migrate';

const env = loadEnv(process.env);

// Default: beside the bundle, which is the deploy layout — the image ships
// `drizzle/` next to `migrate.js`. In the repository the migrations sit in the
// package instead, so the `db:migrate` script passes that path explicitly.
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
