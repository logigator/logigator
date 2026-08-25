import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Client-side error reports. `MailModule` for the transport — the report goes
 * out as plain text with the circuit attached, so it needs no template and none
 * of the localized rendering the transactional mails use.
 */
@Module({
  imports: [MailModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
