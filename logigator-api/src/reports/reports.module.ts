import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Client-side error reports. `MailModule` for the transport: plain text with
 * the circuit attached, so no template and no localized rendering.
 */
@Module({
  imports: [MailModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
