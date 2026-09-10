import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ProfileService } from './profile.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * `forwardRef` because the two modules genuinely need each other:
 * authentication looks accounts up, and account management verifies passwords
 * and issues the same mail tokens.
 */
@Module({
  imports: [forwardRef(() => AuthModule), MailModule],
  controllers: [UsersController],
  providers: [UsersService, ProfileService],
  exports: [UsersService]
})
export class UsersModule {}
