import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

/**
 * Published documents, stars and public profiles. Its own module and its own
 * queries because of the access rule: the listings here filter on
 * `visibility = 'public'` and the owner-scoped services filter on ownership, so
 * forgetting a clause on one cannot reach the other. The one read that is not a
 * listing — a document's own page, reached by its link — carries
 * `linkResolvesFor` instead, and is the one place a document that is nobody
 * else's business can be answered.
 */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService]
})
export class CommunityModule {}
