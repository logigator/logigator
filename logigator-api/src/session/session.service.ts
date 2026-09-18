import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ENV, type Env } from '../config/env';
import { RedisSessionStore } from './redis-session.store';
import './session.types';

/**
 * The cookie the editor and the landing pages read to know whether anyone is
 * signed in. Not `httpOnly` on purpose: the session cookie stays unreadable to
 * scripts, so a *hint* cookie is what lets a client render a signed-in shell
 * without a round trip. It carries no authority — every protected endpoint
 * reads the session, so forging it gains nothing but a UI that corrects itself.
 */
const AUTH_HINT_COOKIE = 'isAuthenticated';

const MINUTE_IN_MS = 60 * 1000;

/** Starts and ends signed-in sessions. */
@Injectable()
export class SessionService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly store: RedisSessionStore
  ) {}

  /**
   * Binds the session to `userId`. The id is regenerated first: reusing an id
   * the caller already held would let whoever handed it over ride along on the
   * new sign-in (session fixation).
   */
  async signIn(request: FastifyRequest, userId: string): Promise<void> {
    await request.session.regenerate();
    request.session.userId = userId;
    request.session.touchedAt = Date.now();
  }

  /**
   * Pushes the session's expiry out, at most once per
   * `SESSION_TOUCH_INTERVAL_MINUTES`.
   *
   * Refreshing is what `rolling` would do on every response, and it is not
   * free: a store write, and two `Set-Cookie` headers the response carries to
   * say what it already said. A session is no shorter for having been pushed to
   * its full lifetime an hour ago, so the interval is the granularity of the
   * slide rather than a shortening of it.
   *
   * Writing the field is the whole mechanism: with `rolling` off,
   * `@fastify/session` saves and re-sends the cookie exactly when the session's
   * own fields have changed.
   */
  touchIfStale(request: FastifyRequest): void {
    const session = request.session;
    if (!session?.userId) return;

    const interval = this.env.SESSION_TOUCH_INTERVAL_MINUTES * MINUTE_IN_MS;
    if (Date.now() - (session.touchedAt ?? 0) >= interval) {
      session.touchedAt = Date.now();
    }
  }

  /**
   * Writes the hint cookie of the response being sent, so it says what the
   * session says.
   *
   * Written alongside the session cookie rather than at sign-in, because that
   * cookie slides: a hint written once would expire underneath a session that
   * is still good. The other direction is the same invariant backwards — a
   * request carrying a hint that no session backs goes back without it.
   *
   * Alongside is literal. The response is asked whether it carries the session
   * cookie, so the two are written on the same responses and never on
   * different ones — which is also what keeps the hint off a response
   * {@link touchIfStale} decided not to refresh.
   *
   * The expiry is the session cookie's own, already slid forward for this
   * response, rather than a second reading of `SESSION_MAX_AGE_DAYS`: an
   * `Expires` is read against the visitor's clock, so a hint given a duration of
   * its own outlives a session cookie a skewed clock discarded on arrival — the
   * failure this method exists to prevent, in the direction it cannot see.
   */
  syncHintCookie(request: FastifyRequest, reply: FastifyReply): void {
    if (request.session?.userId) {
      if (this.wroteSessionCookie(reply)) {
        reply.setCookie(AUTH_HINT_COOKIE, 'true', {
          ...this.cookieOptions(),
          httpOnly: false,
          expires: request.session.cookie.expires ?? undefined
        });
      }
      return;
    }

    // An anonymous request must come back with no `Set-Cookie` at all.
    if (request.cookies[AUTH_HINT_COOKIE] !== undefined) {
      reply.clearCookie(AUTH_HINT_COOKIE, this.cookieOptions());
    }
  }

  /**
   * Ends the session and clears its cookie. Clearing is explicit because
   * `destroy` leaves `request.session` null and `@fastify/session` then writes
   * no `Set-Cookie` of its own. The hint needs no line: a null session is what
   * {@link syncHintCookie} clears it for.
   */
  async signOut(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Read before destroying — afterwards there is no session to ask.
    const { userId, sessionId } = request.session;

    await request.session.destroy();
    if (userId) await this.store.forget(userId, sessionId);

    reply.clearCookie(this.env.SESSION_COOKIE_NAME, this.cookieOptions());
  }

  /**
   * Signs an account out of every session, optionally sparing the one asking.
   * Their hint cookies cannot be cleared from here, since no response is going
   * to them, but {@link syncHintCookie} clears each on its next request.
   */
  async signOutEverywhere(
    userId: string,
    exceptSessionId?: string
  ): Promise<void> {
    await this.store.destroyForUser(userId, exceptSessionId);
  }

  /**
   * Whether `@fastify/session` has already put its cookie on this response.
   * Readable only because this runs in the later of the two `onSend` hooks.
   */
  private wroteSessionCookie(reply: FastifyReply): boolean {
    const written = reply.getHeader('set-cookie');
    const values = Array.isArray(written) ? written : [written];
    return values.some((value) =>
      String(value ?? '').startsWith(`${this.env.SESSION_COOKIE_NAME}=`)
    );
  }

  private cookieOptions() {
    return {
      path: '/',
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax' as const,
      ...(this.env.COOKIE_DOMAIN ? { domain: this.env.COOKIE_DOMAIN } : {})
    };
  }
}
