import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ENV, type Env } from '../config/env';
import { RedisSessionStore } from './redis-session.store';
import './session.types';

/**
 * The cookie the editor and the landing pages read to know whether anyone is
 * signed in. Not `httpOnly` on purpose — that is the whole point of it: the
 * session cookie itself must stay unreadable to scripts, so a *hint* cookie is
 * what lets a client render a signed-in shell without a round trip, and lets it
 * notice a login or logout that happened in another tab.
 *
 * It carries no authority. Every protected endpoint reads the session, so
 * forging this cookie gains nothing but a UI that immediately corrects itself.
 */
const AUTH_HINT_COOKIE = 'isAuthenticated';

/**
 * Seconds, because that is what `Set-Cookie`'s `Max-Age` is and what
 * `@fastify/cookie` passes through. `@fastify/session` redefines its own
 * `cookie.maxAge` as milliseconds — the two are set in different units on
 * purpose, and mixing them silently gives the hint cookie a lifetime a thousand
 * times the session's.
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
   * Binds the session to `userId`.
   *
   * The session id is regenerated first: a caller may already hold a session
   * (an anonymous one, or another account's), and reusing that id would let
   * whoever handed it over ride along on the new sign-in — session fixation.
   */
  async signIn(request: FastifyRequest, userId: string): Promise<void> {
    await request.session.regenerate();
    request.session.userId = userId;
  }

  /**
   * Writes the hint cookie of the response being sent, so it says what the
   * session says.
   *
   * Per response rather than at sign-in, because the session cookie slides:
   * `rolling` re-sets it on every request, so an active user's session outlives
   * the lifetime its first cookie announced. A hint written once would expire
   * underneath a session that is still good, and the editor would render a
   * signed-out shell to a signed-in user.
   *
   * The other direction is the same invariant read backwards: a request carrying
   * a hint that no session backs — an expired session, or one ended from
   * somewhere else — goes back without it.
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

    // Only for a client that has one: an anonymous request must come back with
    // no `Set-Cookie` at all, which is why nothing here runs unconditionally.
    if (request.cookies[AUTH_HINT_COOKIE] !== undefined) {
      reply.clearCookie(AUTH_HINT_COOKIE, this.cookieOptions());
    }
  }

  /**
   * Ends the session and clears its cookie.
   *
   * Clearing it here is explicit because `destroy` leaves `request.session`
   * null, and `@fastify/session` then returns without writing a `Set-Cookie` of
   * its own, so a browser would keep sending an id that resolves to nothing.
   * The hint needs no line here — a null session is exactly what
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
   *
   * Used where a credential changes: a reset ends every session, and a password
   * change from inside the account ends every other one. The hint cookie of those
   * sessions cannot be cleared from here — no response is going to them — but
   * their next request answers with a session that no longer resolves, and
   * {@link syncHintCookie} clears it there.
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
