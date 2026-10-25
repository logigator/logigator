import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  confirmPasswordResetSchema,
  loginRequestSchema,
  registerRequestSchema,
  requestPasswordResetSchema,
  resendVerificationRequestSchema,
  verifyEmailRequestSchema,
  type ConfirmPasswordReset,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterResponse,
  type RequestPasswordReset,
  type ResendVerificationRequest,
  type VerifyEmailRequest
} from '@logigator/contract';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { localeFromRequest } from '../common/locale';
import { SessionService } from '../session/session.service';
import { toUserResponse } from '../users/users.service';
import { AuthService } from './auth.service';

/**
 * The credential endpoints, all JSON. Each one that sends a mail or redeems a
 * token is rate limited per address. A password check counts only wrong
 * passwords, against one budget for `login` and `resend-verification` alike,
 * so spreading guesses across the two buys nothing.
 */
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly session: SessionService
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 30, windowSeconds: 3600, scope: 'register' })
  async register(
    @Body({ schema: registerRequestSchema }) body: RegisterRequest,
    @Req() request: FastifyRequest
  ): Promise<RegisterResponse> {
    await this.auth.register(body, localeFromRequest(request));
    return { verificationRequired: true };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginRequestSchema }) body: LoginRequest,
    @Req() request: FastifyRequest
  ): Promise<LoginResponse> {
    const user = await this.auth.login(body, request.ip);
    await this.session.signIn(request, user.id);
    return toUserResponse(user);
  }

  /** Answers 204 with or without a session, so a stale client can reset. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<void> {
    await this.session.signOut(request, reply);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 30, windowSeconds: 600, scope: 'resend-verification' })
  async resendVerification(
    @Body({ schema: resendVerificationRequestSchema })
    body: ResendVerificationRequest,
    @Req() request: FastifyRequest
  ): Promise<void> {
    await this.auth.resendVerification(
      body,
      request.ip,
      localeFromRequest(request)
    );
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Tokens are unguessable, so this limit bounds load rather than guessing.
  @RateLimit({ limit: 100, windowSeconds: 600, scope: 'token' })
  async verifyEmail(
    @Body({ schema: verifyEmailRequestSchema })
    body: VerifyEmailRequest
  ): Promise<void> {
    await this.auth.verifyEmail(body.token);
  }

  @Post('password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 30, windowSeconds: 3600, scope: 'password-reset' })
  async requestPasswordReset(
    @Body({ schema: requestPasswordResetSchema })
    body: RequestPasswordReset,
    @Req() request: FastifyRequest
  ): Promise<void> {
    await this.auth.requestPasswordReset(
      body.email,
      localeFromRequest(request)
    );
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 100, windowSeconds: 600, scope: 'token' })
  async confirmPasswordReset(
    @Body({ schema: confirmPasswordResetSchema })
    body: ConfirmPasswordReset
  ): Promise<void> {
    await this.auth.confirmPasswordReset(body);
  }
}
