import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordService } from './password.service';

/**
 * `AuthGuard` is exported rather than registered globally: most endpoints will
 * need a session, but the public community listings will not, and an opt-out
 * default is the kind of thing that leaks a private document the day somebody
 * forgets the decorator.
 */
@Module({
  imports: [UsersModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    PasswordService,
    AuthGuard,
    RateLimitGuard
  ],
  exports: [AuthGuard, PasswordService, AuthTokenService]
})
export class AuthModule {}
