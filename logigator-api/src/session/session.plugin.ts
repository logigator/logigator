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
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      maxAge: env.SESSION_MAX_AGE_DAYS * DAY_IN_MS,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {})
    }
  });

  // After the session plugin, so this request's session is resolved — and
  // destroyed, where a handler ended it. The one place the hint cookie is
  // written: `rolling` re-sets the session cookie on every response, and the
  // hint has to slide with it.
  const sessions = app.get<SessionService>(SessionService);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (request, reply) => {
      sessions.syncHintCookie(request, reply);
    });
}
