import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ENV, type Env } from '../config/env';
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Starts and ends signed-in sessions. */
@Injectable()
export class SessionService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * Binds the session to `userId`.
   *
   * The session id is regenerated first: a caller may already hold a session
   * (an anonymous one, or another account's), and reusing that id would let
   * whoever handed it over ride along on the new sign-in — session fixation.
   */
  async signIn(
    request: FastifyRequest,
    reply: FastifyReply,
    userId: string
  ): Promise<void> {
    await request.session.regenerate();
    request.session.userId = userId;
    reply.setCookie(AUTH_HINT_COOKIE, 'true', {
      ...this.cookieOptions(),
      httpOnly: false,
      maxAge: this.env.SESSION_MAX_AGE_DAYS * DAY_IN_MS
    });
  }

  /** Ends the session and clears both cookies. */
  async signOut(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await request.session.destroy();
    reply.clearCookie(AUTH_HINT_COOKIE, this.cookieOptions());
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
