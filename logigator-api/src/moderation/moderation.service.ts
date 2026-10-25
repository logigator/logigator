import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { DB, type Database, type Queryable } from '../database/database.module';
import {
  components,
  documentReports,
  projects,
  type DocumentReportRow
} from '../database/schema';
import type { CircuitTable } from '../documents/circuit-queries';
import type { ReportedKind } from '../reports/document-reports.service';

/** An open report, with the document it names as that document stands now. */
export interface OpenReport {
  id: string;
  createdAt: Date;
  kind: ReportedKind;
  documentId: string;
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
  } | null;
}

/** The longest hidden reason or resolution the columns hold. */
export const MAX_NOTE_LENGTH = 500;

/**
 * What the moderation CLI does: reads the open reports and acts on documents.
 * There is no admin role and no route to any of this; whoever can run the CLI
 * against the database is the moderator.
 *
 * Hiding writes the two moderation columns and nothing else, so the owner's
 * document, its link, its stars and its visibility are exactly as they were
 * when it is unhidden.
 */
@Injectable()
export class ModerationService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async openReports(): Promise<OpenReport[]> {
    const rows = await this.db
      .select()
      .from(documentReports)
      .where(isNull(documentReports.resolvedAt))
      .orderBy(asc(documentReports.createdAt), asc(documentReports.id));

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        createdAt: row.createdAt,
        kind: row.documentKind,
        documentId: row.documentId,
        reason: row.reason,
        explanation: row.explanation,
        contactEmail: row.contactEmail,
        reporterId: row.reporterId,
        document: await this.reportedDocument(row)
      }))
    );
  }

  /**
   * Takes a document out of the community and resolves every open report
   * about it. Hiding a hidden document again replaces the reason and keeps
   * the time it was first hidden.
   *
   * @returns how many open reports this resolved, or null for a link that
   *   names no document.
   */
  async hide(
    kind: ReportedKind,
    link: string,
    reason: string
  ): Promise<{ resolvedReports: number } | null> {
    const trimmed = requireNote(reason);

    const table = tableOf(kind);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(table)
        .set({
          hiddenAt: sql`coalesce(${table.hiddenAt}, now())`,
          hiddenReason: trimmed
        })
        .where(eq(table.link, link))
        .returning({ id: table.id });
      if (!row) return null;

      return {
        resolvedReports: await resolveOpenReports(
          tx,
          kind,
          row.id,
          `Hidden: ${trimmed}`.slice(0, MAX_NOTE_LENGTH)
        )
      };
    });
  }

  /**
   * Puts a hidden document back in whatever state its owner left it in.
   *
   * @returns whether the link names a document at all.
   */
  async unhide(kind: ReportedKind, link: string): Promise<boolean> {
    const table = tableOf(kind);
    const [row] = await this.db
      .update(table)
      .set({ hiddenAt: null, hiddenReason: null })
      .where(eq(table.link, link))
      .returning({ id: table.id });
    return row !== undefined;
  }

  /**
   * Closes one report with a note on what was done, for the reports that need
   * no hiding.
   *
   * @returns whether an open report of that id existed.
   */
  async resolve(reportId: string, note: string): Promise<boolean> {
    const resolution = requireNote(note);
    const [row] = await this.db
      .update(documentReports)
      .set({ resolvedAt: new Date(), resolution })
      .where(
        and(
          eq(documentReports.id, reportId),
          isNull(documentReports.resolvedAt)
        )
      )
      .returning({ id: documentReports.id });
    return row !== undefined;
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
        hiddenAt: table.hiddenAt
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
      hidden: row.hiddenAt !== null
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

function tableOf(kind: ReportedKind): CircuitTable {
  return kind === 'project' ? projects : components;
}

async function resolveOpenReports(
  tx: Queryable,
  kind: ReportedKind,
  documentId: string,
  resolution: string
): Promise<number> {
  const resolved = await tx
    .update(documentReports)
    .set({ resolvedAt: new Date(), resolution })
    .where(
      and(
        eq(documentReports.documentKind, kind),
        eq(documentReports.documentId, documentId),
        isNull(documentReports.resolvedAt)
      )
    )
    .returning({ id: documentReports.id });
  return resolved.length;
}
