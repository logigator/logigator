import { forwardRef, Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { PasswordService } from './password.service';

/**
 * `AuthGuard` is exported rather than registered globally: the public community
 * listings need no session, and an opt-out default leaks a private document the
 * day somebody forgets the decorator.
 */
@Module({
  imports: [forwardRef(() => UsersModule), MailModule],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    AuthTokenService,
    GoogleAuthService,
    PasswordService,
    AuthGuard,
    RateLimitGuard
  ],
  exports: [AuthGuard, PasswordService, AuthTokenService, GoogleAuthService]
})
export class AuthModule {}
