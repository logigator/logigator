import { Injectable, Logger } from '@nestjs/common';
import type { ReportErrorRequest } from '@logigator/contract';
import { MailService } from '../mail/mail.service';

/**
 * Where a client-side error report goes.
 *
 * Always to the log, as one structured line. That replaces the legacy backend's
 * append-to-a-file sink, which needed a path, a rotation policy and a writable
 * volume to be useful — in a container the process's own output is collected by
 * something better at all three, and a report nobody had configured a file for
 * was simply discarded.
 *
 * And to a mailbox when one is configured, because a report is worth nothing
 * unread. The circuit that was open goes as an attachment; it is kept out of the
 * log line for the reason it is kept out of the mail body — a hundred kilobytes
 * of JSON per report would bury everything around it.
 *
 * Nothing here is trusted for anything but text. The endpoint is
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
      // Which account hit a bug is most of what makes a report actionable, and
      // it is the one field a client cannot assert.
      user: reporterId,
      message: report.message,
      at: location(report),
      userAgent: report.userAgent,
      client: report.client,
      userMessage: report.userMessage,
      hasCircuit: Boolean(report.projectDump ?? report.project)
    };

    this.logger.warn(JSON.stringify(summary));

    // A report never fails the request that sent it: the client is telling us
    // something already went wrong, and answering with a second failure loses
    // the report and tells the user nothing they can act on. The log line above
    // is the part that always works.
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
