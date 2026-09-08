import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { RETURN_PATH_PARAM } from '@logigator/core';
import { ENV, type Env } from '../config/env';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { SessionService } from '../session/session.service';
import {
  GoogleAuthError,
  GoogleAuthService,
  type GoogleAuthFailure
} from './google-auth.service';

/**
 * The two browser-facing routes of the OAuth round trip. A user agent walks
 * through them, not a client library, so they answer with redirects and a
 * failure comes back as `?error=` on the return URL rather than an error body.
 */
@Controller('auth/google')
@UseGuards(RateLimitGuard)
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleAuthService,
    private readonly session: SessionService,
    @Inject(ENV) private readonly env: Env
  ) {}

  /**
   * Sends the browser to Google. A caller who is already signed in is starting
   * a link rather than a sign-in, and the flow records which.
   *
   * `returnUrl` is where the browser should end up afterwards. It is stored
   * with the flow rather than handed to Google, and only ever as a path on this
   * origin — the flow decides the redirect, so an arbitrary target here would
   * make an unauthenticated open redirect out of a real Logigator link.
   */
  @Get()
  @RateLimit({ limit: 20, windowSeconds: 600, scope: 'oauth' })
  async start(
    @Query() query: Record<string, string>,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const url = await this.google.createAuthorizationUrl(
      request.session?.userId,
      query[RETURN_PATH_PARAM]
    );
    await reply.redirect(url, 302);
  }

  /**
   * Where Google returns to. On success the session starts here and the browser
   * continues to the app; on failure it continues to the same place with a
   * reason attached.
   */
  @Get('callback')
  @RateLimit({ limit: 20, windowSeconds: 600, scope: 'oauth' })
  async callback(
    @Query() query: Record<string, string>,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ): Promise<void> {
    try {
      const { user, returnPath } = await this.google.completeCallback(
        query,
        request.session?.userId
      );
      if (user) await this.session.signIn(request, user.id);

      await reply.redirect(`${this.env.PUBLIC_URL}${returnPath ?? ''}`, 302);
    } catch (error) {
      // Only the flow's own failures become a redirect; anything else is a
      // defect for the error filter.
      if (!(error instanceof GoogleAuthError)) throw error;

      await reply.redirect(
        this.failureUrl(error.failure, error.returnPath),
        302
      );
    }
  }

  /**
   * Where a failed round trip lands: the configured sign-in page, naming what
   * went wrong and carrying the destination the flow was for, so the retry it
   * offers still ends up where the visitor was going.
   *
   * The page is configuration and the path was checked when the flow started —
   * a redirect target read straight off this request would be an open redirect,
   * and this route is unauthenticated.
   */
  private failureUrl(
    failure: GoogleAuthFailure,
    returnPath: string | undefined
  ): string {
    const url = new URL(this.env.OAUTH_RETURN_URL);
    url.searchParams.set('error', failure);
    if (returnPath) {
      url.searchParams.set(RETURN_PATH_PARAM, returnPath);
    }
    return url.href;
  }
}
