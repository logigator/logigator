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
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SessionService } from '../session/session.service';
import { toUserResponse } from '../users/users.service';
import { AuthService } from './auth.service';

/**
 * The credential endpoints, all JSON.
 *
 * Each one that takes a password or sends a mail is rate limited per address:
 * guessing passwords and using the API as a mail relay are what an
 * unauthenticated caller can otherwise do at volume. The budgets are shared by
 * scope, so spreading attempts across `login` and `resend-verification` does not
 * buy more of them.
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
  @RateLimit({ limit: 5, windowSeconds: 3600, scope: 'register' })
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
    @Req() request: FastifyRequest
  ): Promise<RegisterResponse> {
    await this.auth.register(body, localeFromRequest(request));
    return { verificationRequired: true };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, windowSeconds: 600, scope: 'credentials' })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<LoginResponse> {
    const user = await this.auth.login(body);
    await this.session.signIn(request, reply, user.id);
    return toUserResponse(user);
  }

  /** Answers 204 whether or not there was a session, so a stale client can always clear itself. */
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
  @RateLimit({ limit: 10, windowSeconds: 600, scope: 'credentials' })
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationRequestSchema))
    body: ResendVerificationRequest,
    @Req() request: FastifyRequest
  ): Promise<void> {
    await this.auth.resendVerification(body, localeFromRequest(request));
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 20, windowSeconds: 600, scope: 'token' })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailRequestSchema))
    body: VerifyEmailRequest
  ): Promise<void> {
    await this.auth.verifyEmail(body.token);
  }

  @Post('password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 5, windowSeconds: 3600, scope: 'password-reset' })
  async requestPasswordReset(
    @Body(new ZodValidationPipe(requestPasswordResetSchema))
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
  @RateLimit({ limit: 20, windowSeconds: 600, scope: 'token' })
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(confirmPasswordResetSchema))
    body: ConfirmPasswordReset
  ): Promise<void> {
    await this.auth.confirmPasswordReset(body);
  }
}
