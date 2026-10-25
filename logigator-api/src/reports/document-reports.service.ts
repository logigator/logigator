import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ReportDocumentRequest } from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import { components, documentReports, projects } from '../database/schema';
import { findByResolvingLink } from '../documents/circuit-queries';
import { MailService } from '../mail/mail.service';

/** The two kinds of document a report can name, as the API spells them. */
export type ReportedKind = 'project' | 'component';

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

    const summary = {
      report: row?.id,
      kind,
      document: document.id,
      link,
      owner: document.userId,
      reason: body.reason,
      reporter: reporterId
    };
    this.logger.warn(JSON.stringify(summary));

    try {
      await this.mail.sendDocumentReport({
        subject: `Document report (${body.reason}): ${document.name}`,
        body: [
          JSON.stringify(summary, null, 2),
          `\nPage: ${this.env.PUBLIC_URL}/en/community/${kind}s/${link}`,
          `Contact: ${body.contactEmail ?? 'none given'}`,
          `\nExplanation:\n${body.explanation}`,
          `\nTo hide it:\n  yarn workspace logigator-api run db:moderate hide ${kind} ${link} --reason "…"`
        ].join('\n'),
        ...(body.contactEmail ? { replyTo: body.contactEmail } : {})
      });
    } catch (error) {
      this.logger.error('Could not mail the document report', error);
    }
  }
}
