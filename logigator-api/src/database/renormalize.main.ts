/* Entry point of the `renormalize.js` bundle: re-derives stored documents and
   the tables derived from them, then exits.

   A third Rspack entry beside `migrate.js`, for the same reason: a release runs
   it with plain `node`, so it must not need a TypeScript loader or any dev
   dependency. Unlike the migration runner it boots the real application
   container, because the whole point is to write documents through the same
   parse-and-extract path every other write uses — a second implementation of
   that path is exactly what would let the derived tables drift.

   eslint-disable no-console: this is a CLI whose only output channel is the
   terminal.

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

  // An application context, not an HTTP server: nothing here serves a request,
  // and the providers are what is wanted.
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

    // Non-zero when any row could not be processed, so a release notices rather
    // than moving on with a table it half-converted. Every other row was still
    // rewritten — the pass does not stop on one bad document.
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
