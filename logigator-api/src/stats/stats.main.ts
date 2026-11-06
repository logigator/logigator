/* Entry point of the `stats.js` bundle: prints the database's counts in the
   Prometheus text format, then exits.

   An Rspack entry beside `moderate.js` that boots no application container,
   only one connection: the host's monitoring agent runs it every few minutes
   inside the running `api` container, beside the server. Its output is written
   to a file the agent reads, so a failure prints nothing to stdout and exits
   1, and the file keeps the last good counts.

   eslint-disable no-console: a CLI whose only output channel is the terminal.

   Usage:
     node stats.js > logigator.prom
*/
/* eslint-disable no-console */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv } from '../config/env';
import { relations } from '../database/schema';
import { readStats } from './stats-queries';
import { statsRegistry } from './stats-registry';

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  try {
    const db = drizzle({ client: pool, relations });
    // One snapshot for every count, and nothing here may write.
    const stats = await db.transaction(
      (tx) => readStats(tx, env.TEXT_ANALYSIS_WORKER_ENABLED),
      { isolationLevel: 'repeatable read', accessMode: 'read only' }
    );
    process.stdout.write(await statsRegistry(stats).metrics());
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
