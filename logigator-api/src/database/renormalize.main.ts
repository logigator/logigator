/* Entry point of the `renormalize.js` bundle: re-derives stored documents and
   the tables derived from them, then exits.

   A third Rspack entry beside `migrate.js`, so a release runs it with plain
   `node`. Unlike the migration runner it boots the real application container:
   documents go through the same parse-and-extract path every other write uses,
   and a second implementation of that path is what would let the derived tables
   drift.

   eslint-disable no-console: a CLI whose only output channel is the terminal.

   Usage:
     node renormalize.js          # the format-bump pass: rows an older version wrote
     node renormalize.js --all    # the re-extract pass: rebuild every derived row
*/
/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/env';
import { RenormalizeService } from '../documents/renormalize.service';

async function main(): Promise<number> {
  const all = process.argv.includes('--all');
  const env = loadEnv(process.env);

  // An application context, not an HTTP server: only the providers are wanted.
  const app = await NestFactory.createApplicationContext(
    AppModule.forEnv(env),
    { logger: ['error', 'warn', 'log'] }
  );

  try {
    const report = await app.get(RenormalizeService).run(all);
    console.log(
      all
        ? 'Re-extracted every stored document.'
        : 'Re-normalized documents written at an older format version.'
    );
    console.table(report);

    // Non-zero when any row could not be processed, so a release notices. Every
    // other row is still rewritten: the pass does not stop on one bad document.
    return Object.values(report).some((table) => table.failed > 0) ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
