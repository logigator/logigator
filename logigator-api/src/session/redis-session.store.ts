import { Inject, Injectable } from '@nestjs/common';
import type { Session } from 'fastify';
import type { SessionStore } from '@fastify/session';
import { ENV, type Env } from '../config/env';
import { RedisService } from '../redis/redis.service';

const DAY_IN_SECONDS = 24 * 60 * 60;

/**
 * Session storage in Redis, as the three callbacks `@fastify/session` asks for.
 *
 * Written here rather than taken from `connect-redis`, which imports
 * `express-session` for its `Store` base class and speaks only node-redis'
 * option shapes — two dependencies and a middleware framework this server does
 * not otherwise contain, for thirty lines of `get`/`set`/`del`.
 *
 * Expiry is Redis' own: the key carries the same lifetime as the cookie, so an
 * abandoned session disappears without a sweep job. Sessions are saved on every
 * response (`rolling`), which slides that expiry forward while a user is active.
 */
@Injectable()
export class RedisSessionStore implements SessionStore {
  private readonly maxAgeSeconds: number;

  constructor(
    private readonly redis: RedisService,
    @Inject(ENV) env: Env
  ) {
    this.maxAgeSeconds = env.SESSION_MAX_AGE_DAYS * DAY_IN_SECONDS;
  }

  set(
    sessionId: string,
    session: Session,
    callback: (err?: unknown) => void
  ): void {
    this.redis
      .setEx(key(sessionId), JSON.stringify(session), this.ttlFor(session))
      .then(() => callback(), callback);
  }

  get(
    sessionId: string,
    callback: (err: unknown, result?: Session | null) => void
  ): void {
    this.redis.getJson<Session>(key(sessionId)).then(
      // An unreadable or missing value is an absent session: the caller then
      // starts a fresh one, which is the right outcome for an expired cookie.
      (session) => callback(null, session),
      (error: unknown) => callback(error)
    );
  }

  destroy(sessionId: string, callback: (err?: unknown) => void): void {
    this.redis.delete(key(sessionId)).then(() => callback(), callback);
  }

  /**
   * Keeps the Redis key and the cookie expiring together. The cookie's own
   * `expires` is authoritative when present — a handler may have shortened it
   * for one request — and the configured maximum is the fallback.
   */
  private ttlFor(session: Session): number {
    const expires = session.cookie?.expires;
    if (!expires) return this.maxAgeSeconds;

    const remaining = Math.ceil(
      (new Date(expires).getTime() - Date.now()) / 1000
    );
    return remaining > 0 ? remaining : 1;
  }
}

function key(sessionId: string): string {
  return `sess:${sessionId}`;
}
