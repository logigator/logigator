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

/**
 * Seconds, matching `Set-Cookie`'s `Max-Age`. `@fastify/session` redefines its
 * own `cookie.maxAge` as milliseconds; mixing the two silently gives the hint
 * cookie a lifetime a thousand times the session's.
 */
const DAY_IN_SECONDS = 24 * 60 * 60;

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
  }

  /**
   * Writes the hint cookie of the response being sent, so it says what the
   * session says.
   *
   * Per response rather than at sign-in, because the session cookie slides: a
   * hint written once would expire underneath a session that is still good. The
   * other direction is the same invariant backwards — a request carrying a hint
   * that no session backs goes back without it.
   */
  syncHintCookie(request: FastifyRequest, reply: FastifyReply): void {
    if (request.session?.userId) {
      reply.setCookie(AUTH_HINT_COOKIE, 'true', {
        ...this.cookieOptions(),
        httpOnly: false,
        maxAge: this.env.SESSION_MAX_AGE_DAYS * DAY_IN_SECONDS
      });
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

  private cookieOptions() {
    return {
      path: '/',
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax' as const,
      ...(this.env.COOKIE_DOMAIN ? { domain: this.env.COOKIE_DOMAIN } : {})
    };
  }
}
