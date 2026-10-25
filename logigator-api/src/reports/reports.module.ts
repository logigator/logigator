import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { DocumentReportsService } from './document-reports.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Client-side error reports, and reports about documents. `MailModule` for
 * the transport: plain text to the operator, so no template and no localized
 * rendering. A document report is taken on the document's own community
 * route, so its service is exported to the module that owns those routes.
 */
@Module({
  imports: [MailModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, DocumentReportsService],
  exports: [DocumentReportsService]
})
export class ReportsModule {}
