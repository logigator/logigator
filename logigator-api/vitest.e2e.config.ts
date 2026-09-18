import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/*
 * The E2E suite runs the real application against a real PostgreSQL and Redis:
 * one Nest app per spec file, booted through the same plugin registration as
 * production, driven through injected requests. It is a separate config, and a
 * separate script (`yarn test:e2e:api`), because it needs services that
 * `yarn test:api` deliberately does not — the unit suite has to stay runnable
 * anywhere, and a suite that silently skips when a database is missing would
 * report green having tested nothing.
 *
 * `fileParallelism` is off: each file creates and drops its own throwaway
 * database, and concurrent `CREATE DATABASE` on one server contends for the
 * template.
 */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    fileParallelism: false,
    // Booting an app, migrating a fresh database and hashing passwords is slower
    // than a unit spec, though not by as much as it sounds — the harness lowers
    // the bcrypt cost.
    testTimeout: 30_000,
    hookTimeout: 60_000
  },
  resolve: {
    alias: {
      '@logigator/core': fileURLToPath(
        new URL('../logigator-core/src/public-api.ts', import.meta.url)
      ),
      '@logigator/contract': fileURLToPath(
        new URL('../logigator-contract/src/public-api.ts', import.meta.url)
      )
    }
  }
});
