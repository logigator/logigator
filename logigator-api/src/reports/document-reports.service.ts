import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  DocumentReportReason,
  ReportDocumentRequest
} from '@logigator/contract';
import { and, eq, isNull } from 'drizzle-orm';
import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import {
  components,
  documentReports,
  projects,
  type DocumentReportRow
} from '../database/schema';
import { findByResolvingLink } from '../documents/circuit-queries';
import { MailService } from '../mail/mail.service';

/** The two kinds of document a report can name, as the API spells them. */
export type ReportedKind = 'project' | 'component';

/** One stored report and the document it names, as the operator is told. */
export interface OperatorReport {
  reportId: string | undefined;
  source: 'reader' | 'machine';
  kind: ReportedKind;
  document: { id: string; link: string; name: string; ownerId: string };
  reason: DocumentReportReason;
  explanation: string;
  contactEmail: string | null;
  reporterId: string | null;
  /** Whether the machine's verdict that opened the report hid the document. */
  hidden: boolean;
}

/**
 * The operator's mail about one report, from a reader or the machine alike:
 * the summary that is also logged, the page, the explanation, and the
 * `db:moderate` commands that apply. A report whose verdict hid the document
 * has a subject of its own, so it cannot pass for an ordinary report, and
 * offers the commands that confirm or reverse the hide.
 */
export function operatorReportMail(
  report: OperatorReport,
  publicUrl: string
): { subject: string; body: string; replyTo?: string } {
  const { kind, document } = report;
  const command = 'yarn workspace logigator-api run db:moderate';
  const commands = report.hidden
    ? [
        `To confirm the hide, with a reason shown to the owner:`,
        `  ${command} hide ${kind} ${document.link} --reason "…"`,
        `To reverse it:`,
        `  ${command} unhide ${kind} ${document.link}`
      ]
    : [
        `To hide it:`,
        `  ${command} hide ${kind} ${document.link} --reason "…"`,
        ...(report.reportId
          ? [
              `To close the report without hiding:`,
              `  ${command} resolve ${report.reportId} --note "…"`
            ]
          : [])
      ];

  return {
    subject: report.hidden
      ? `Hidden automatically: ${document.name}`
      : report.source === 'machine'
        ? `Document report (${report.reason}, machine): ${document.name}`
        : `Document report (${report.reason}): ${document.name}`,
    body: [
      JSON.stringify(reportSummary(report), null, 2),
      `\nPage: ${publicUrl}/en/community/${kind}s/${document.link}`,
      `Source: ${report.source}`,
      `Contact: ${report.contactEmail ?? 'none given'}`,
      `\nExplanation:\n${report.explanation}`,
      `\n${commands.join('\n')}`
    ].join('\n'),
    ...(report.contactEmail ? { replyTo: report.contactEmail } : {})
  };
}

/** What is logged of a report: who and what, never the explanation. */
export function reportSummary(report: OperatorReport): Record<string, unknown> {
  return {
    report: report.reportId,
    source: report.source,
    kind: report.kind,
    document: report.document.id,
    link: report.document.link,
    owner: report.document.ownerId,
    reason: report.reason,
    reporter: report.reporterId,
    ...(report.source === 'machine' ? { hidden: report.hidden } : {})
  };
}

/**
 * Logs a stored report and mails it to the operator. The row is the record
 * and the mail only tells somebody to look, so a failed send is logged and
 * the report stands.
 */
export async function announceReport(
  report: OperatorReport,
  mail: MailService,
  publicUrl: string,
  logger: Logger
): Promise<void> {
  logger.warn(JSON.stringify(reportSummary(report)));
  try {
    await mail.sendDocumentReport(operatorReportMail(report, publicUrl));
  } catch (error) {
    logger.error(`Could not mail the ${report.source} report`, error);
  }
}

/**
 * The open reports about one document, those of one source only when it is
 * given.
 */
export function openReportsAbout(
  kind: ReportedKind,
  documentId: string,
  source?: DocumentReportRow['source']
) {
  return and(
    eq(documentReports.documentKind, kind),
    eq(documentReports.documentId, documentId),
    source ? eq(documentReports.source, source) : undefined,
    isNull(documentReports.resolvedAt)
  );
}

/**
 * Notices about documents: stored, logged, and mailed to `REPORT_MAIL_TO` when
 * it is set. Anybody the document's link resolves for may send one, signed in
 * or not, so a report names exactly the documents its sender could see.
 *
 * The stored row is the record; the mail only tells somebody to look, so a
 * mail that fails is logged and the report still succeeds.
 */
@Injectable()
export class DocumentReportsService {
  private readonly logger = new Logger('DocumentReport');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly mail: MailService
  ) {}

  async report(
    kind: ReportedKind,
    link: string,
    body: ReportDocumentRequest,
    reporterId: string | null
  ): Promise<void> {
    const document =
      kind === 'project'
        ? await findByResolvingLink(this.db, projects, link, reporterId)
        : await findByResolvingLink(this.db, components, link, reporterId);
    if (!document) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'not_found',
        'No such document.'
      );
    }

    const [row] = await this.db
      .insert(documentReports)
      .values({
        documentKind: kind,
        documentId: document.id,
        reason: body.reason,
        explanation: body.explanation,
        contactEmail: body.contactEmail ?? null,
        reporterId
      })
      .returning({ id: documentReports.id });

    await announceReport(
      {
        reportId: row?.id,
        source: 'reader',
        kind,
        document: {
          id: document.id,
          link,
          name: document.name,
          ownerId: document.userId
        },
        reason: body.reason,
        explanation: body.explanation,
        contactEmail: body.contactEmail ?? null,
        reporterId,
        hidden: false
      },
      this.mail,
      this.env.PUBLIC_URL,
      this.logger
    );
  }
}
