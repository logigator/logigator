import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

/**
 * Published documents, stars and public profiles. Its own module and its own
 * queries because of the access rule: everything here filters on
 * `public = true` and the owner-scoped services filter on ownership, so
 * forgetting a flag on one cannot reach the other.
 */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService]
})
export class CommunityModule {}
