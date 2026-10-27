import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import { documentReports } from '../database/schema';
import { MailService } from '../mail/mail.service';
import {
  operatorReportMail,
  type OperatorReport,
  type ReportedKind,
  reportSummary
} from '../reports/document-reports.service';
import { ModerationService, tableOf } from './moderation.service';
import {
  type ModerationVerdict,
  SEVERE_CATEGORIES
} from './moderation-verdict';

/** The model call a verdict came from, as far as the report names it. */
export interface VerdictCall {
  /** The model that answered, never the preset that chose it. */
  model: string | null;
  /** OpenRouter's generation id, which finds the call on its Activity page. */
  generationId: string | null;
}

/** One verdict the text analysis worker got for a document's current text. */
export interface MachineVerdictInput {
  kind: ReportedKind;
  documentId: string;
  /** The `textDigest` the verdict was given for. */
  textDigest: string;
  verdict: ModerationVerdict;
  /** The call whose reply gave the verdict, named in the report. */
  call: VerdictCall | null;
}

/**
 * What became of a verdict: nothing (`none`, a text a moderator cleared, a
 * text edited since, or an open machine report already there), a report, or
 * a hide with its report.
 */
export type MachineVerdictResult = 'ignored' | 'reported' | 'hidden';

/**
 * Acts on the text analysis worker's moderation verdicts.
 *
 * A severe category the model is certain of hides the document at once, when
 * `MODERATION_AUTO_HIDE` allows it; every other flag only opens a report. A
 * hide opens its report too, so a person confirms or reverses every hide the
 * machine made, and both the operator and the owner are mailed of it.
 *
 * Each write carries its own guard in its `WHERE`: the text is still the one
 * judged, no moderator has cleared it, and nothing hid it meanwhile. The read
 * before them only names the document in the mails and skips the plain cases.
 * A text a moderator cleared stays cleared until it changes; without that,
 * the next retry of a refused translation would hide it again.
 */
@Injectable()
export class MachineModerationService {
  private readonly logger = new Logger('MachineModeration');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly mail: MailService,
    private readonly moderation: ModerationService
  ) {}

  async apply(input: MachineVerdictInput): Promise<MachineVerdictResult> {
    const { verdict } = input;
    if (verdict.category === 'none') return 'ignored';
    const category = verdict.category;

    const table = tableOf(input.kind);
    const [document] = await this.db
      .select({
        id: table.id,
        link: table.link,
        name: table.name,
        userId: table.userId,
        textLanguageHint: table.textLanguageHint,
        textDigest: table.textDigest,
        moderatedDigest: table.moderatedDigest,
        hiddenAt: table.hiddenAt
      })
      .from(table)
      .where(eq(table.id, input.documentId))
      .limit(1);
    if (
      !document ||
      document.textDigest !== input.textDigest ||
      document.moderatedDigest === document.textDigest ||
      document.hiddenAt !== null
    ) {
      return 'ignored';
    }

    const hides =
      this.env.MODERATION_AUTO_HIDE &&
      verdict.certain &&
      SEVERE_CATEGORIES.includes(category);
    const explanation = describeVerdict(verdict, input.call, hides);
    const guard = sql`${table.id} = ${input.documentId}
      AND ${table.textDigest} = ${input.textDigest}
      AND ${table.moderatedDigest} IS DISTINCT FROM ${table.textDigest}
      AND ${table.hiddenAt} IS NULL`;

    let reportId: string | undefined;
    if (hides) {
      // A hide opens a report of its own, whatever is open already, so the
      // report it opens is the one that names the verdict that hid.
      reportId = await this.db.transaction(async (tx) => {
        const [hidden] = await tx
          .update(table)
          .set({
            hiddenAt: sql`now()`,
            hiddenReason: '',
            hiddenBy: 'machine',
            hiddenCategory: category
          })
          .where(guard)
          .returning({ id: table.id });
        if (!hidden) return undefined;

        const [report] = await tx
          .insert(documentReports)
          .values({
            documentKind: input.kind,
            documentId: input.documentId,
            reason: category,
            explanation,
            contactEmail: null,
            reporterId: null,
            source: 'machine',
            textDigest: input.textDigest
          })
          .returning({ id: documentReports.id });
        return report?.id;
      });
    } else {
      // One open machine report per document: a flag already waiting for a
      // person says what another would.
      const result = await this.db.execute<{ id: string }>(sql`
        INSERT INTO ${documentReports}
               (document_kind, document_id, reason, explanation, source,
                text_digest)
        SELECT ${input.kind}::document_kind, ${table.id},
               ${category}::report_reason, ${explanation},
               'machine'::report_source, ${input.textDigest}
          FROM ${table}
         WHERE ${guard}
           AND NOT EXISTS (
                 SELECT 1 FROM ${documentReports}
                  WHERE ${and(
                    eq(documentReports.documentKind, input.kind),
                    eq(documentReports.documentId, input.documentId),
                    eq(documentReports.source, 'machine'),
                    isNull(documentReports.resolvedAt)
                  )})
        RETURNING id
      `);
      reportId = result.rows[0]?.id;
    }
    if (!reportId) return 'ignored';

    const report: OperatorReport = {
      reportId,
      source: 'machine',
      kind: input.kind,
      document: {
        id: document.id,
        link: document.link,
        name: document.name,
        ownerId: document.userId
      },
      reason: category,
      explanation,
      contactEmail: null,
      reporterId: null,
      hidden: hides
    };
    this.logger.warn(JSON.stringify(reportSummary(report)));

    try {
      await this.mail.sendDocumentReport(
        operatorReportMail(report, this.env.PUBLIC_URL)
      );
    } catch (error) {
      this.logger.error('Could not mail the machine report', error);
    }
    if (!hides) return 'reported';

    // Never undoes the hide: the owner sees the notice on the page either way.
    await this.moderation.mailOwnerHidden(
      { kind: input.kind, ...document },
      { by: 'machine', category }
    );
    return 'hidden';
  }
}

/**
 * The report's explanation: who judged, how sure, what was done, and the
 * model's note last. The note is capped where the reply is read, so the whole
 * fits the column.
 */
function describeVerdict(
  verdict: ModerationVerdict,
  call: VerdictCall | null,
  hid: boolean
): string {
  const head = [
    `Model: ${call?.model ?? 'unknown'}`,
    `Generation: ${call?.generationId ?? 'unknown'}`,
    `Certain: ${verdict.certain ? 'yes' : 'no'}`,
    `Hidden automatically: ${hid ? 'yes' : 'no'}`,
    'Note: '
  ].join('\n');
  return head + verdict.note;
}
