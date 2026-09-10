/* drizzle-kit's config. `generate` diffs the TypeScript schema against the last
   snapshot and writes reviewable SQL under `drizzle/`; the SQL is what gets
   applied, by `runMigrations` (see src/database/migrate.ts) rather than by kit,
   so a deploy needs no dev tooling.

   `dbCredentials` is only read by the commands that talk to a live database
   (`push`, `pull`, `check`). Those run on the host, where the compose Postgres is
   published on localhost — unlike the API itself, which reaches it under the
   compose service name. */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://logigator:logigator@localhost:5432/logigator'
  }
});
