import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Env } from '../config/env';
import { RedisSessionStore } from './redis-session.store';
import { SessionService } from './session.service';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Installs cookie parsing and sessions on the Fastify instance. A function so
 * the E2E suite installs exactly the same plugins on its own instance.
 * `@fastify/session` needs `@fastify/cookie` registered first.
 *
 * CSRF: `sameSite: 'lax'` keeps the cookie off cross-site requests that are not
 * top-level navigations, and the API sends no CORS headers, so no token layer
 * is needed on top.
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
    // Anonymous requests must not mint a session: a Redis key and a cookie for
    // every crawler, which consent rules frown on too.
    saveUninitialized: false,
    // Off so that saving and re-sending the cookie follow the session's own
    // fields rather than the response count. `SessionService.touchIfStale` is
    // then what slides the expiry, on the interval it decides.
    rolling: false,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      maxAge: env.SESSION_MAX_AGE_DAYS * DAY_IN_MS,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
    }
  });

  const sessions = app.get<SessionService>(SessionService);
  const fastify = app.getHttpAdapter().getInstance();

  // After the session plugin's own `onRequest`, so the session is resolved, and
  // before any handler, so a request that ends the session still overrules it.
  fastify.addHook('onRequest', async (request) => {
    sessions.touchIfStale(request);
  });

  // Likewise the later `onSend`, which is what lets the hint read whether the
  // session cookie is on the response it is about to join. The one place the
  // hint is written.
  fastify.addHook('onSend', async (request, reply) => {
    sessions.syncHintCookie(request, reply);
  });
}
