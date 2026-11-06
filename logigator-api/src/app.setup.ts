import fastifyCompress from '@fastify/compress';
import fastifyMultipart from '@fastify/multipart';
import { randomBytes } from 'node:crypto';
import type { FastifyServerOptions } from 'fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from './config/env';
import { registerHttpMetrics } from './metrics/http-metrics';
import { registerCspReportRoute } from './reports/csp-report.route';
import { registerSessionPlugins } from './session/session.plugin';

/**
 * Fastify options derived from the environment. `trustProxy` names the proxies
 * in front of the process, so `request.ip` is the caller's address rather than
 * Caddy's — the rate limiter counts per address.
 *
 * `bodyLimit` is set because Fastify's own default is 1 MiB, which a large
 * board exceeds: the parser refuses it before any handler, pipe or guard runs.
 *
 * Every log line of a request carries its `reqId`: Cloudflare's `Cf-Ray` for
 * the request when the edge sent one, which names the same request in
 * Cloudflare's own logs, and 12 random characters otherwise. Fastify's default
 * is a counter that starts over with every process.
 */
export function apiServerOptions(env: Env): FastifyServerOptions {
  return {
    logger: {
      level: env.LOG_LEVEL,
      // The level's name rather than pino's number, as every other service
      // in the log store writes it.
      formatters: {
        level: (label) => ({ level: label }),
        // Fastify's request lines time to the nanosecond; a hundredth of a
        // millisecond is plenty.
        log: (fields) =>
          typeof fields['responseTime'] === 'number'
            ? {
                ...fields,
                responseTime: Math.round(fields['responseTime'] * 100) / 100
              }
            : fields
      },
      // No `pid` or `hostname`: always 1 and the container's id, which the log
      // store already names every line by.
      base: undefined
    },
    requestIdHeader: 'cf-ray',
    genReqId: () => randomBytes(9).toString('base64url'),
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
  // First, so the hooks reach every route registered after them.
  registerHttpMetrics(app);
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
  await registerCspReportRoute(app);

  // Caddy proxies `/api/*` here; controllers declare their paths without it.
  app.setGlobalPrefix('api');
}
