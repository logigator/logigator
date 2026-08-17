import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from '../config/env';
import { RedisSessionStore } from './redis-session.store';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Installs cookie parsing and sessions on the Fastify instance.
 *
 * A function rather than inline bootstrap code because the E2E suite has to
 * install exactly the same plugins on its own instance — a session bug that only
 * appears under real cookie signing is precisely what those specs are for.
 *
 * `@fastify/session` needs `@fastify/cookie` registered first, and the store
 * comes out of the DI container, since it is the same Redis client everything
 * else uses.
 *
 * CSRF: `sameSite: 'lax'` keeps the cookie off cross-site requests that are not
 * top-level navigations, and the API sends no CORS headers, so a foreign origin
 * can neither read a response nor make the browser attach the cookie to a
 * state-changing one. No token layer is needed on top of that.
 */
export async function registerSessionPlugins(
  app: NestFastifyApplication,
  env: Env
): Promise<void> {
  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: env.SESSION_SECRET,
    cookieName: env.SESSION_COOKIE_NAME,
    store: app.get<RedisSessionStore>(RedisSessionStore),
    // Anonymous requests must not mint a session: it would write a Redis key and
    // set a cookie for every crawler, and consent rules frown on both.
    saveUninitialized: false,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      maxAge: env.SESSION_MAX_AGE_DAYS * DAY_IN_MS,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
    }
  });
}
