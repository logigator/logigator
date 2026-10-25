/* Entry point of the `seed-examples.js` bundle: writes the checked-in examples
   into the seed account, then exits.

   A fourth Rspack entry beside `renormalize.js`, booting the real application
   container for the same reason: the documents go through the write path every
   save uses, so a seeded row is one the server could have written itself.
   Idempotent, so it is safe to run on every deploy or after every pull.

   Run from where the server runs: the previews land under STORAGE_DIR, which
   resolves against the working directory, so `db:seed-examples` steps out of
   the package first. Run from `logigator-api/`, it writes a volume nobody
   serves.

   eslint-disable no-console: a CLI whose only output channel is the terminal.

   Usage:
     node seed-examples.js              # write what differs from the manifest
     node seed-examples.js --previews   # also re-upload every preview
*/
/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { EXAMPLES_ACCOUNT_ID } from '@logigator/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/env';
import {
  defaultExamplesFolder,
  loadExampleSet
} from '../documents/example-set';
import { SeedExamplesService } from '../documents/seed-examples.service';

async function main(): Promise<void> {
  const previews = process.argv.includes('--previews');
  const env = loadEnv(process.env);
  // Read before the container boots, so an incomplete checkout fails without
  // touching the database.
  const set = await loadExampleSet(defaultExamplesFolder());

  // An application context, not an HTTP server: only the providers are wanted.
  const app = await NestFactory.createApplicationContext(
    AppModule.forEnv(env),
    { logger: ['error', 'warn', 'log'] }
  );

  try {
    const report = await app.get(SeedExamplesService).run(set, { previews });
    console.log(`Seeded the examples into account ${EXAMPLES_ACCOUNT_ID}.`);
    console.table(report);
  } finally {
    await app.close();
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
