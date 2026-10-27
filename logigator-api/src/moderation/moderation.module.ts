import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { MachineModerationService } from './machine-moderation.service';
import { ModerationService } from './moderation.service';

/**
 * Moderation's services: acting on reports and on the machine's verdicts. No
 * controller: nothing here is reachable over HTTP. `MailModule` for the
 * owner's mails and the operator's report mail.
 */
@Module({
  imports: [MailModule],
  providers: [ModerationService, MachineModerationService],
  exports: [ModerationService, MachineModerationService]
})
export class ModerationModule {}
