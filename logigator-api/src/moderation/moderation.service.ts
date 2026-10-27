import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { resolveLocale } from '../common/locale';
import { DB, type Database, type Queryable } from '../database/database.module';
import {
  components,
  documentReports,
  projects,
  users,
  type DocumentReportRow
} from '../database/schema';
import type { CircuitTable } from '../documents/circuit-queries';
import {
  type HideReason,
  MailService,
  type MailRecipient,
  type ModeratedDocument
} from '../mail/mail.service';
import type { ReportedKind } from '../reports/document-reports.service';

/** An open report, with the document it names as that document stands now. */
export interface OpenReport {
  id: string;
  createdAt: Date;
  kind: ReportedKind;
  documentId: string;
  source: DocumentReportRow['source'];
  reason: DocumentReportRow['reason'];
  explanation: string;
  contactEmail: string | null;
  reporterId: string | null;
  /** Null once the document is deleted: the report outlives it. */
  document: {
    id: string;
    name: string;
    link: string;
    ownerId: string;
    hidden: boolean;
    /** Who hid it, null while it is not hidden. */
    hiddenBy: 'moderator' | 'machine' | null;
  } | null;
}

/** A document a moderation mail goes out about, with what picks its language. */
export interface NoticedDocument {
  kind: ReportedKind;
  link: string;
  name: string;
  userId: string;
  textLanguageHint: string | null;
}

/** The longest hidden reason or resolution the columns hold. */
export const MAX_NOTE_LENGTH = 500;

/** The resolution `unhide` writes on the machine's reports it closes. */
export const UNHIDDEN_RESOLUTION = 'Unhidden by a moderator';

/**
 * What the moderation CLI does: reads the open reports and acts on documents.
 * There is no admin role and no route to any of this; whoever can run the CLI
 * against the database is the moderator.
 *
 * Hiding writes the moderation columns and nothing else, so the owner's
 * document, its link, its stars and its visibility are exactly as they were
 * when it is unhidden.
 *
 * The owner hears of a hide and an unhide by mail. The row is the decision
 * and the mail only reports it, so a mail that fails is logged and the
 * action stands; the CLI says whether the owner was mailed.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger('Moderation');

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly mail: MailService
  ) {}

  /**
   * Every open report, those about a document the machine hid first: a hide
   * nobody has looked at yet is the decision most worth a person's time.
   */
  async openReports(): Promise<OpenReport[]> {
    const rows = await this.db
      .select()
      .from(documentReports)
      .where(isNull(documentReports.resolvedAt))
      .orderBy(asc(documentReports.createdAt), asc(documentReports.id));

    const reports = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        createdAt: row.createdAt,
        kind: row.documentKind,
        documentId: row.documentId,
        source: row.source,
        reason: row.reason,
        explanation: row.explanation,
        contactEmail: row.contactEmail,
        reporterId: row.reporterId,
        document: await this.reportedDocument(row)
      }))
    );
    // Stable, so each group keeps the age order of the query.
    return reports.sort(
      (a, b) =>
        Number(b.document?.hiddenBy === 'machine') -
        Number(a.document?.hiddenBy === 'machine')
    );
  }

  /**
   * Takes a document out of the community, resolves every open report about
   * it and mails its owner the reason. Hiding a hidden document again
   * replaces the reason and keeps the time it was first hidden; hiding one
   * the machine hid confirms that hide as a moderator's, with the reason the
   * owner is now shown.
   *
   * @returns how many open reports this resolved and whether the owner was
   *   mailed, or null for a link that names no document.
   */
  async hide(
    kind: ReportedKind,
    link: string,
    reason: string
  ): Promise<{ resolvedReports: number; ownerMailed: boolean } | null> {
    const trimmed = requireNote(reason);

    const table = tableOf(kind);
    const hidden = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(table)
        .set({
          hiddenAt: sql`coalesce(${table.hiddenAt}, now())`,
          hiddenReason: trimmed,
          hiddenBy: 'moderator',
          hiddenCategory: null
        })
        .where(eq(table.link, link))
        .returning(noticeColumns(table));
      if (!row) return null;

      return {
        document: { kind, ...row },
        resolvedReports: await resolveOpenReports(
          tx,
          kind,
          row.id,
          `Hidden: ${trimmed}`.slice(0, MAX_NOTE_LENGTH)
        )
      };
    });
    if (!hidden) return null;

    return {
      resolvedReports: hidden.resolvedReports,
      ownerMailed: await this.mailOwnerHidden(hidden.document, {
        by: 'moderator',
        reason: trimmed
      })
    };
  }

  /**
   * Puts a hidden document back in whatever state its owner left it in, and
   * clears its current text: the machine neither hides nor reports that text
   * again, and its open reports from the machine are resolved. The owner is
   * mailed when the document was hidden.
   *
   * @returns whether the owner was mailed, or null for a link that names no
   *   document.
   */
  async unhide(
    kind: ReportedKind,
    link: string
  ): Promise<{ ownerMailed: boolean } | null> {
    const table = tableOf(kind);
    const unhidden = await this.db.transaction(async (tx) => {
      // Joined to itself for the row as it was before the update, which is
      // what says whether there was a hide to tell the owner about.
      const result = await tx.execute<{
        id: string;
        user_id: string;
        name: string;
        link: string;
        text_language_hint: string | null;
        was_hidden: boolean;
      }>(sql`
        UPDATE ${table} AS doc
           SET hidden_at = NULL, hidden_reason = NULL, hidden_by = NULL,
               hidden_category = NULL, moderated_digest = doc.text_digest
          FROM ${table} AS before
         WHERE before.id = doc.id AND doc.link = ${link}
        RETURNING doc.id, doc.user_id, doc.name, doc.link, doc.text_language_hint,
                  before.hidden_at IS NOT NULL AS was_hidden
      `);
      const [row] = result.rows;
      if (!row) return null;

      await resolveOpenReports(tx, kind, row.id, UNHIDDEN_RESOLUTION, {
        machineOnly: true
      });
      return row;
    });
    if (!unhidden) return null;

    return {
      ownerMailed:
        unhidden.was_hidden &&
        (await this.mailOwnerUnhidden({
          kind,
          link: unhidden.link,
          name: unhidden.name,
          userId: unhidden.user_id,
          textLanguageHint: unhidden.text_language_hint
        }))
    };
  }

  /**
   * Closes one report with a note on what was done, for the reports that need
   * no hiding. Resolving a report of the machine clears the text it judged, so
   * the next verdict on that same text does not open it again; a later edit
   * is judged afresh.
   *
   * A machine report whose document the machine still holds hidden is not
   * closed: the hide waits for a person to confirm it with `hide` or reverse
   * it with `unhide`, and closing its report would leave it hidden with
   * nobody looking.
   */
  async resolve(
    reportId: string,
    note: string
  ): Promise<'resolved' | 'missing' | 'machine-hidden'> {
    const resolution = requireNote(note);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(documentReports)
        .set({ resolvedAt: new Date(), resolution })
        .where(
          and(
            eq(documentReports.id, reportId),
            isNull(documentReports.resolvedAt),
            sql`NOT (${documentReports.source} = 'machine' AND (
                  EXISTS (SELECT 1 FROM ${projects}
                           WHERE ${projects.id} = ${documentReports.documentId}
                             AND ${projects.hiddenBy} = 'machine')
                  OR EXISTS (SELECT 1 FROM ${components}
                              WHERE ${components.id} = ${documentReports.documentId}
                                AND ${components.hiddenBy} = 'machine')))`
          )
        )
        .returning({
          kind: documentReports.documentKind,
          documentId: documentReports.documentId,
          source: documentReports.source,
          textDigest: documentReports.textDigest
        });
      if (!row) {
        const [open] = await tx
          .select({ id: documentReports.id })
          .from(documentReports)
          .where(
            and(
              eq(documentReports.id, reportId),
              isNull(documentReports.resolvedAt)
            )
          )
          .limit(1);
        return open ? 'machine-hidden' : 'missing';
      }

      if (row.source === 'machine' && row.textDigest !== null) {
        const table = tableOf(row.kind);
        await tx
          .update(table)
          .set({ moderatedDigest: row.textDigest })
          .where(eq(table.id, row.documentId));
      }
      return 'resolved';
    });
  }

  /**
   * Mails a document's owner that it was hidden, in the language of its text
   * where that is a site language. Only to a verified address: an unverified
   * one may be anybody's.
   *
   * @returns whether the mail was sent.
   */
  mailOwnerHidden(
    document: NoticedDocument,
    reason: HideReason
  ): Promise<boolean> {
    return this.mailOwner(document, (recipient, moderated) =>
      this.mail.sendDocumentHidden(recipient, moderated, reason)
    );
  }

  /** As {@link mailOwnerHidden}, for a document back in the community. */
  mailOwnerUnhidden(document: NoticedDocument): Promise<boolean> {
    return this.mailOwner(document, (recipient, moderated) =>
      this.mail.sendDocumentUnhidden(recipient, moderated)
    );
  }

  private async mailOwner(
    document: NoticedDocument,
    send: (
      recipient: MailRecipient,
      moderated: ModeratedDocument
    ) => Promise<void>
  ): Promise<boolean> {
    try {
      const [owner] = await this.db
        .select({
          email: users.email,
          username: users.username,
          emailVerified: users.emailVerified
        })
        .from(users)
        .where(eq(users.id, document.userId))
        .limit(1);
      if (!owner?.emailVerified) return false;

      // The hint is the owner's interface language at their last write of
      // the text; accounts store no language of their own.
      await send(
        {
          email: owner.email,
          username: owner.username,
          locale: resolveLocale(document.textLanguageHint)
        },
        { kind: document.kind, link: document.link, name: document.name }
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Could not mail the owner of ${document.kind} ${document.link}`,
        error
      );
      return false;
    }
  }

  private async reportedDocument(
    report: DocumentReportRow
  ): Promise<OpenReport['document']> {
    const table = tableOf(report.documentKind);
    const [row] = await this.db
      .select({
        id: table.id,
        name: table.name,
        link: table.link,
        ownerId: table.userId,
        hiddenAt: table.hiddenAt,
        hiddenBy: table.hiddenBy
      })
      .from(table)
      .where(eq(table.id, report.documentId))
      .limit(1);
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      link: row.link,
      ownerId: row.ownerId,
      hidden: row.hiddenAt !== null,
      hiddenBy: row.hiddenAt === null ? null : row.hiddenBy
    };
  }
}

/** A reason or a note, which the CLI cannot leave out. */
function requireNote(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.length > MAX_NOTE_LENGTH) {
    throw new RangeError(
      `A text of 1 to ${MAX_NOTE_LENGTH} characters is required.`
    );
  }
  return trimmed;
}

export function tableOf(kind: ReportedKind): CircuitTable {
  return kind === 'project' ? projects : components;
}

/** What an owner's mail needs of a document, as a `returning` selection. */
function noticeColumns(table: CircuitTable) {
  return {
    id: table.id,
    link: table.link,
    name: table.name,
    userId: table.userId,
    textLanguageHint: table.textLanguageHint
  };
}

async function resolveOpenReports(
  tx: Queryable,
  kind: ReportedKind,
  documentId: string,
  resolution: string,
  options: { machineOnly?: boolean } = {}
): Promise<number> {
  const resolved = await tx
    .update(documentReports)
    .set({ resolvedAt: new Date(), resolution })
    .where(
      and(
        eq(documentReports.documentKind, kind),
        eq(documentReports.documentId, documentId),
        isNull(documentReports.resolvedAt),
        options.machineOnly ? eq(documentReports.source, 'machine') : undefined
      )
    )
    .returning({ id: documentReports.id });
  return resolved.length;
}
