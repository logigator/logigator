import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';

/**
 * What the moderation CLI runs on. No controller: nothing here is reachable
 * over HTTP.
 */
@Module({
  providers: [ModerationService],
  exports: [ModerationService]
})
export class ModerationModule {}
