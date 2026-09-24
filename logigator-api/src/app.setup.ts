import fastifyCompress from '@fastify/compress';
import fastifyMultipart from '@fastify/multipart';
import type { FastifyServerOptions } from 'fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from './config/env';
import { registerSessionPlugins } from './session/session.plugin';

/**
 * Fastify options derived from the environment. `trustProxy` names the proxies
 * in front of the process, so `request.ip` is the caller's address rather than
 * Caddy's — the rate limiter counts per address.
 *
 * `bodyLimit` is set because Fastify's own default is 1 MiB, which a large
 * board exceeds: the parser refuses it before any handler, pipe or guard runs.
 */
export function apiServerOptions(env: Env): FastifyServerOptions {
  return {
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: env.REQUEST_MAX_BYTES
  };
}

/**
 * Everything that has to be true of the HTTP layer before it serves a request,
 * in one place so the server and the E2E suite cannot drift.
 */
export async function configureApiApp(
  app: NestFastifyApplication,
  env: Env
): Promise<void> {
  await app.register(fastifyMultipart, {
    // Two files per request: a preview upload carries the light and the dark
    // render together.
    limits: { files: 2, fileSize: env.UPLOAD_MAX_BYTES },
    // The plugin reports the limit by throwing from `toBuffer`, which the error
    // filter answers 500 to. Off, the truncation is a flag a handler reads.
    throwFileSizeLimit: false
  });
  // Requests only. The editor gzips every document write — a browser never
  // compresses a request body of its own, there being no handshake for it —
  // and this inflates it in `preParsing`, before the body parser. Responses
  // stay Caddy's business: it already answers `encode zstd gzip`.
  //
  // The decompressor reports the encoded length on the stream it returns, so
  // Fastify's own parser bounds the inflated body *and* the raw one against
  // `bodyLimit`: the zip bomb is capped by `REQUEST_MAX_BYTES`, with nothing
  // to count here. A request with no `content-encoding` passes through
  // untouched, which is what keeps curl and every older build working.
  await app.register(fastifyCompress, {
    global: false,
    globalDecompression: true,
    requestEncodings: ['gzip']
  });
  await registerSessionPlugins(app, env);

  // Caddy proxies `/api/*` here; controllers declare their paths without it.
  app.setGlobalPrefix('api');
}
