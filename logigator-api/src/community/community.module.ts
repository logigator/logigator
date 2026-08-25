import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

/**
 * Published documents, stars and public profiles.
 *
 * Its own module, and its own queries, because the access rule is the whole
 * point: everything here filters on `public = true`, and the owner-scoped
 * services filter on ownership. Neither can be reached by forgetting a flag on
 * the other.
 */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService]
})
export class CommunityModule {}
