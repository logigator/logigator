import { Inject, Injectable } from '@nestjs/common';
import type { Session } from 'fastify';
import type { SessionStore } from '@fastify/session';
import { ENV, type Env } from '../config/env';
import { RedisService } from '../redis/redis.service';

const DAY_IN_SECONDS = 24 * 60 * 60;

/**
 * Session storage in Redis: the three callbacks `@fastify/session` asks for,
 * and an index of which sessions belong to which account. In-repo rather than
 * `connect-redis`, which would pull in `express-session` for its `Store` base
 * class.
 *
 * Expiry is Redis' own: the key carries the same lifetime as the cookie, so an
 * abandoned session disappears without a sweep job, and `rolling` slides that
 * expiry forward while a user is active.
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
    this.persist(sessionId, session).then(() => callback(), callback);
  }

  get(
    sessionId: string,
    callback: (err: unknown, result?: Session | null) => void
  ): void {
    this.redis.getJson<Session>(key(sessionId)).then(
      // An unreadable or missing value is an absent session, so the caller
      // starts a fresh one — the right outcome for an expired cookie.
      (session) => callback(null, session),
      (error: unknown) => callback(error)
    );
  }

  destroy(sessionId: string, callback: (err?: unknown) => void): void {
    this.redis.delete(key(sessionId)).then(() => callback(), callback);
  }

  /**
   * Deletes every session of an account, optionally sparing one — the spared id
   * is for a user changing their own password from a session that has no reason
   * to end.
   *
   * Ids that no longer resolve are deleted as no-ops and dropped from the index
   * on the way through, which is the only pruning it needs: `destroy` is handed
   * a session id and no user, so a session that ends on its own leaves its id
   * behind here.
   */
  async destroyForUser(
    userId: string,
    exceptSessionId?: string
  ): Promise<void> {
    const index = userIndexKey(userId);
    const doomed = (await this.redis.membersOf(index)).filter(
      (sessionId) => sessionId !== exceptSessionId
    );
    if (doomed.length === 0) return;

    await this.redis.delete(...doomed.map(key));
    await this.redis.removeFromSet(index, doomed);
  }

  /** Drops one id from the index, for a session that is ending deliberately. */
  async forget(userId: string, sessionId: string): Promise<void> {
    await this.redis.removeFromSet(userIndexKey(userId), [sessionId]);
  }

  /**
   * Writes the session, and once it belongs to somebody records its id under
   * that account, so one user's sessions are findable without a key scan.
   */
  private async persist(sessionId: string, session: Session): Promise<void> {
    await this.redis.setEx(
      key(sessionId),
      JSON.stringify(session),
      this.ttlFor(session)
    );

    if (session.userId) {
      await this.redis.addToSet(
        userIndexKey(session.userId),
        sessionId,
        this.maxAgeSeconds
      );
    }
  }

  /**
   * Keeps the Redis key and the cookie expiring together. The cookie's own
   * `expires` wins when present; the configured maximum is the fallback.
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

function userIndexKey(userId: string): string {
  return `sessions:user:${userId}`;
}
