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
import { ENV, type Env } from '../config/env';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { SessionService } from '../session/session.service';
import {
  GoogleAuthError,
  GoogleAuthService,
  type GoogleAuthFailure
} from './google-auth.service';

/**
 * The two browser-facing routes of the OAuth round trip. They answer with
 * redirects rather than JSON — the user agent is walking through them, not a
 * client library — which is also why failures come back as `?error=` on the
 * return URL instead of an error body no page would ever show.
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
   * Sends the browser to Google. A caller who is already signed in is starting a
   * link rather than a sign-in, and the flow records which.
   */
  @Get()
  @RateLimit({ limit: 20, windowSeconds: 600, scope: 'oauth' })
  async start(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const url = await this.google.createAuthorizationUrl(
      request.session?.userId
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
      const user = await this.google.completeCallback(
        query,
        request.session?.userId
      );
      if (user) await this.session.signIn(request, reply, user.id);

      await reply.redirect(this.env.PUBLIC_URL, 302);
    } catch (error) {
      // Only the flow's own failures become a redirect; anything else is a
      // defect and belongs in the error filter's hands.
      if (!(error instanceof GoogleAuthError)) throw error;

      await reply.redirect(this.returnUrlWith(error.failure), 302);
    }
  }

  /**
   * The failure target is configured, never taken from the request: a redirect a
   * caller can choose is an open redirect, and this one is reachable
   * unauthenticated.
   */
  private returnUrlWith(failure: GoogleAuthFailure): string {
    const url = new URL(this.env.OAUTH_RETURN_URL);
    url.searchParams.set('error', failure);
    return url.href;
  }
}
