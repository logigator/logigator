import fastifyMultipart from '@fastify/multipart';
import type { FastifyServerOptions } from 'fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from './config/env';
import { registerSessionPlugins } from './session/session.plugin';

/**
 * Fastify options derived from the environment.
 *
 * `trustProxy` names the proxies sitting in front of the process, so
 * `request.ip` is the caller's address rather than Caddy's — the rate limiter
 * counts per address. It trusts none by default: a directly reachable server must
 * not let a caller pick its own identity through a header.
 */
export function apiServerOptions(env: Env): FastifyServerOptions {
  return {
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.TRUST_PROXY
  };
}

/**
 * Everything that has to be true of the HTTP layer before it serves a request,
 * in one place so the server and the E2E suite cannot drift: the specs exercise
 * the same plugins, the same cookie signing and the same route prefix as
 * production.
 */
export async function configureApiApp(
  app: NestFastifyApplication,
  env: Env
): Promise<void> {
  await app.register(fastifyMultipart, {
    // Two files per request, each capped: a preview upload carries the light and
    // the dark render together, and the limit is what keeps a stream from
    // filling the disk before a handler sees it.
    limits: { files: 2, fileSize: env.UPLOAD_MAX_BYTES },
    // The plugin's own way of reporting the limit is to throw from `toBuffer`,
    // which lands in the error filter as an unhandled defect — a 500 for a file
    // that is merely too big. Off, the truncation shows up as a flag the handler
    // reads and answers 413 to.
    throwFileSizeLimit: false
  });
  await registerSessionPlugins(app, env);

  // Caddy proxies `/api/*` here; controllers declare their paths without it.
  app.setGlobalPrefix('api');
}
