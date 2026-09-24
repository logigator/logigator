import { Injectable, Logger } from '@nestjs/common';
import type { ReportErrorRequest } from '@logigator/contract';
import { MailService } from '../mail/mail.service';

/**
 * Where a client-side error report goes: always one structured log line, and a
 * mail too when `REPORT_MAIL_TO` is set. The circuit that was open is an
 * attachment, kept out of both the log line and the mail body — a hundred
 * kilobytes of JSON per report would bury everything around it.
 *
 * Nothing here is trusted for anything but text: the endpoint is
 * unauthenticated and rate-limited, every field is length-capped by the
 * contract, and what a client says about itself is recorded as a claim.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger('ErrorReport');

  constructor(private readonly mail: MailService) {}

  async record(
    report: ReportErrorRequest,
    reporterId: string | null
  ): Promise<void> {
    const summary = {
      source: report.source ?? 'unknown',
      correlationId: report.correlationId,
      // The one field a client cannot assert, and most of what makes a report
      // actionable.
      user: reporterId,
      message: report.message,
      at: location(report),
      userAgent: report.userAgent,
      client: report.client,
      userMessage: report.userMessage,
      hasCircuit: Boolean(report.projectDump ?? report.project)
    };

    this.logger.warn(JSON.stringify(summary));

    // A report never fails the request that sent it — something already went
    // wrong client-side, and the log line above is the part that always works.
    try {
      await this.mail.sendErrorReport({
        subject: `Error report: ${report.message ?? 'no message'}`,
        body: [
          JSON.stringify(summary, null, 2),
          report.stack ? `\nStack:\n${report.stack}` : '',
          report.logs ? `\nRecent logs:\n${report.logs}` : ''
        ].join('\n'),
        circuit: report.projectDump ?? stringify(report.project)
      });
    } catch (error) {
      this.logger.error('Could not mail the error report', error);
    }
  }
}

function location(report: ReportErrorRequest): string | undefined {
  if (!report.file) return undefined;
  return report.line === undefined
    ? report.file
    : `${report.file}:${report.line}:${report.col ?? 0}`;
}

function stringify(value: unknown): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}
