import fastifyMultipart from '@fastify/multipart';
import type { FastifyServerOptions } from 'fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from './config/env';
import { registerSessionPlugins } from './session/session.plugin';

/**
 * Fastify options derived from the environment. `trustProxy` names the proxies
 * in front of the process, so `request.ip` is the caller's address rather than
 * Caddy's — the rate limiter counts per address.
 */
export function apiServerOptions(env: Env): FastifyServerOptions {
  return {
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.TRUST_PROXY
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
  await registerSessionPlugins(app, env);

  // Caddy proxies `/api/*` here; controllers declare their paths without it.
  app.setGlobalPrefix('api');
}
