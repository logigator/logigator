import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DocumentReportReason } from '@logigator/contract';
import { and, eq, type SQL, sql } from 'drizzle-orm';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import { documentReports } from '../database/schema';
import { type CircuitTable, tableOf } from '../documents/circuit-queries';
import { awaitingCheck } from '../documents/text-check';
import { MailService } from '../mail/mail.service';
import type { CallUsage } from '../text-analysis/text-analyzer';
import {
  announceReport,
  type OperatorReport,
  openReportsAbout,
  type ReportedKind
} from '../reports/document-reports.service';
import {
  ModerationService,
  type NoticedDocument,
  noticeColumns
} from './moderation.service';
import {
  type ModerationVerdict,
  SEVERE_CATEGORIES
} from './moderation-verdict';

/** The model call a verdict came from, as far as the report names it. */
export type VerdictCall = Pick<CallUsage, 'model' | 'generationId'>;

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
 * A text the text analysis worker gave up on without ever getting a verdict
 * for it, after `attempts` failed calls.
 */
export interface UnjudgedTextInput {
  kind: ReportedKind;
  documentId: string;
  /** The `textDigest` no verdict was obtained for. */
  textDigest: string;
  attempts: number;
  /** The last call made for it, named in the report. */
  call: VerdictCall | null;
}

/**
 * What became of a verdict: nothing (`none`, a text a moderator cleared, a
 * text edited since, or an open machine report already there), a report, or
 * a hide with its report.
 */
export type MachineVerdictResult = 'ignored' | 'reported' | 'hidden';

/** A report the machine opened, and the document as its mails name it. */
interface OpenedReport {
  reportId: string;
  document: Omit<NoticedDocument, 'kind'> & { id: string };
}

/**
 * Acts on the text analysis worker's moderation verdicts.
 *
 * A severe category the model is certain of hides the document at once, when
 * `MODERATION_AUTO_HIDE` allows it; every other flag only opens a report. A
 * hide opens its report too, so a person confirms or reverses every hide the
 * machine made, and both the operator and the owner are mailed of it.
 *
 * Each write carries its own guard in its `WHERE`: the text is still the one
 * judged, no moderator has cleared it, and nothing hid it meanwhile. The write
 * returns what the mails name of the document, so there is no read before it.
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
    const hides =
      this.env.MODERATION_AUTO_HIDE &&
      verdict.certain &&
      SEVERE_CATEGORIES.includes(category);
    const explanation = describeVerdict(verdict, input.call, hides);
    const guard = sql`${holdsJudgedText(table, input)}
      AND ${table.moderatedDigest} IS DISTINCT FROM ${table.textDigest}`;

    // One open machine report per document for a flag: one already waiting
    // for a person says what another would.
    const opened = hides
      ? await this.hide(input, category, explanation, guard)
      : await this.openReport(
          input,
          category,
          explanation,
          guard,
          openReportsAbout(input.kind, input.documentId, 'machine')
        );
    if (!opened) return 'ignored';

    const announced = this.announce(input.kind, opened, {
      reason: category,
      explanation,
      hidden: hides
    });
    if (!hides) {
      await announced;
      return 'reported';
    }
    // Never undoes the hide: the owner sees the notice on the page either way.
    await Promise.all([
      announced,
      this.moderation.mailOwnerHidden(
        { kind: input.kind, ...opened.document },
        { by: 'machine', category }
      )
    ]);
    return 'hidden';
  }

  /**
   * Opens a report for a published text no verdict could be obtained for: the
   * calls kept failing, a reply cut short for one. Such a text is never
   * checked, so it stays out of the listings (`text-check.ts`) until a person
   * looks at it — resolving the report clears the text, which checks it — or
   * its author edits it, which starts the analysis over.
   *
   * `other` and not certain, like a declined reply: a person decides, and
   * nothing is hidden. Guarded like a verdict's report, and on the text being
   * unchecked still, since a verdict of an earlier attempt already checked it.
   * One open report per text rather than per document: it is resolving this
   * one that checks the text, so a report about an earlier text cannot stand
   * in for it.
   *
   * @returns whether a report was opened.
   */
  async reportUnjudged(input: UnjudgedTextInput): Promise<boolean> {
    const table = tableOf(input.kind);
    const explanation = describeVerdict(
      {
        category: 'other',
        certain: false,
        note: `No verdict could be obtained after ${input.attempts} attempts.`
      },
      input.call,
      false
    );
    const opened = await this.openReport(
      input,
      'other',
      explanation,
      sql`${holdsJudgedText(table, input)} AND ${awaitingCheck(table, true)}`,
      and(
        openReportsAbout(input.kind, input.documentId, 'machine'),
        eq(documentReports.textDigest, input.textDigest)
      )
    );
    if (!opened) return false;

    await this.announce(input.kind, opened, {
      reason: 'other',
      explanation,
      hidden: false
    });
    return true;
  }

  /**
   * Hides the document where `guard` holds, with a report of its own whatever
   * is open already, so the report it opens is the one that names the verdict
   * that hid.
   */
  private hide(
    input: JudgedText,
    category: DocumentReportReason,
    explanation: string,
    guard: SQL
  ): Promise<OpenedReport | undefined> {
    const table = tableOf(input.kind);
    return this.db.transaction(async (tx) => {
      const [hidden] = await tx
        .update(table)
        .set({
          hiddenAt: sql`now()`,
          hiddenReason: '',
          hiddenBy: 'machine',
          hiddenCategory: category
        })
        .where(guard)
        .returning(noticeColumns(table));
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
      return report && { reportId: report.id, document: hidden };
    });
  }

  /**
   * Opens a machine report about the text judged where `guard` holds of the
   * document and no report `existing` matches is open.
   */
  private async openReport(
    input: JudgedText,
    reason: DocumentReportReason,
    explanation: string,
    guard: SQL,
    existing: SQL | undefined
  ): Promise<OpenedReport | undefined> {
    const table = tableOf(input.kind);
    const result = await this.db.execute<{
      id: string;
      link: string;
      name: string;
      user_id: string;
      text_language_hint: string | null;
    }>(sql`
      WITH opened AS (
        INSERT INTO ${documentReports}
               (document_kind, document_id, reason, explanation, source,
                text_digest)
        SELECT ${input.kind}::document_kind, ${table.id},
               ${reason}::report_reason, ${explanation},
               'machine'::report_source, ${input.textDigest}
          FROM ${table}
         WHERE ${guard}
           AND NOT EXISTS (SELECT 1 FROM ${documentReports} WHERE ${existing})
        RETURNING id
      )
      SELECT opened.id, ${table.link} AS link, ${table.name} AS name,
             ${table.userId} AS user_id,
             ${table.textLanguageHint} AS text_language_hint
        FROM opened, ${table}
       WHERE ${table.id} = ${input.documentId}
    `);
    const [row] = result.rows;
    return (
      row && {
        reportId: row.id,
        document: {
          id: input.documentId,
          link: row.link,
          name: row.name,
          userId: row.user_id,
          textLanguageHint: row.text_language_hint
        }
      }
    );
  }

  /** Announces a report the machine opened, as a reader's is announced. */
  private announce(
    kind: ReportedKind,
    { reportId, document }: OpenedReport,
    verdict: Pick<OperatorReport, 'reason' | 'explanation' | 'hidden'>
  ): Promise<void> {
    return announceReport(
      {
        reportId,
        source: 'machine',
        kind,
        document: {
          id: document.id,
          link: document.link,
          name: document.name,
          ownerId: document.userId
        },
        contactEmail: null,
        reporterId: null,
        ...verdict
      },
      this.mail,
      this.env.PUBLIC_URL,
      this.logger
    );
  }
}

/** Which text of which document a verdict, or its absence, is about. */
type JudgedText = Pick<
  MachineVerdictInput,
  'kind' | 'documentId' | 'textDigest'
>;

/** The document still holds the text judged, and nothing hid it since. */
function holdsJudgedText(
  table: CircuitTable,
  { documentId, textDigest }: JudgedText
): SQL {
  return sql`${table.id} = ${documentId}
    AND ${table.textDigest} = ${textDigest}
    AND ${table.hiddenAt} IS NULL`;
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
