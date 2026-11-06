import { count, isNull, ne, sql } from 'drizzle-orm';
import { EXAMPLES_ACCOUNT_ID } from '@logigator/core';
import type { Queryable } from '../database/database.module';
import {
  componentStars,
  components,
  documentReports,
  documentVisibility,
  MAX_ANALYSIS_ATTEMPTS,
  projectStars,
  projects,
  users
} from '../database/schema';
import { type CircuitTable, kindOf } from '../documents/circuit-queries';
import { awaitingCheck } from '../documents/text-check';

export type DocumentKind = 'project' | 'component';
export type Visibility = (typeof documentVisibility.enumValues)[number];

/** The documents of one kind, visibility and hidden state. */
export interface DocumentGroup {
  kind: DocumentKind;
  visibility: Visibility;
  hidden: boolean;
  count: number;
}

/** What the database holds, the examples account left out. */
export interface Totals {
  users: Record<'verified' | 'unverified', number>;
  /** Only the groups that hold a document. */
  documents: DocumentGroup[];
  stars: number;
  openReports: Record<'human' | 'machine', number>;
  textsAwaitingCheck: number;
  textsParked: number;
  storageBytes: Record<'documents' | 'previews', number>;
}

/**
 * Reads the totals. The examples account is left out of everything it owns or
 * authored: its row, its documents and their bytes and texts, and the stars it
 * gave. Stars and reports on its documents are other accounts' activity and
 * count. `analysisRuns` is the env's `TEXT_ANALYSIS_WORKER_ENABLED`.
 */
export async function readTotals(
  db: Queryable,
  analysisRuns: boolean
): Promise<Totals> {
  const totals: Totals = {
    users: { verified: 0, unverified: 0 },
    documents: [],
    stars: 0,
    openReports: { human: 0, machine: 0 },
    textsAwaitingCheck: 0,
    textsParked: 0,
    storageBytes: { documents: 0, previews: 0 }
  };

  const accounts = await db
    .select({ verified: users.emailVerified, count: count() })
    .from(users)
    .where(ne(users.id, EXAMPLES_ACCOUNT_ID))
    .groupBy(users.emailVerified);
  for (const row of accounts) {
    totals.users[row.verified ? 'verified' : 'unverified'] = row.count;
  }

  for (const table of [projects, components]) {
    for (const group of await readDocumentGroups(db, table, analysisRuns)) {
      totals.documents.push(group);
      totals.storageBytes.documents += group.documentBytes;
      totals.storageBytes.previews += group.previewBytes;
      if (group.hidden || group.visibility === 'private') continue;
      totals.textsParked += group.parked;
      if (group.visibility === 'public') {
        totals.textsAwaitingCheck += group.awaitingCheck;
      }
    }
  }

  for (const stars of [projectStars, componentStars]) {
    const [row] = await db
      .select({ count: count() })
      .from(stars)
      .where(ne(stars.userId, EXAMPLES_ACCOUNT_ID));
    totals.stars += row?.count ?? 0;
  }

  const reports = await db
    .select({ source: documentReports.source, count: count() })
    .from(documentReports)
    .where(
      sql`${isNull(documentReports.resolvedAt)} and ${documentReports.reporterId} is distinct from ${EXAMPLES_ACCOUNT_ID}`
    )
    .groupBy(documentReports.source);
  for (const row of reports) {
    totals.openReports[row.source === 'reader' ? 'human' : 'machine'] =
      row.count;
  }

  return totals;
}

interface DocumentGroupRow extends DocumentGroup {
  documentBytes: number;
  previewBytes: number;
  awaitingCheck: number;
  parked: number;
}

/**
 * One kind's documents by visibility and hidden state, in one scan. Parked is
 * a pending text whose failures reached the limit, the half of
 * `analysisPendingWhere` the worker steps over.
 */
async function readDocumentGroups(
  db: Queryable,
  table: CircuitTable,
  analysisRuns: boolean
): Promise<DocumentGroupRow[]> {
  const hidden = sql<boolean>`(${table.hiddenAt} is not null)`;
  const rows = await db
    .select({
      visibility: table.visibility,
      hidden,
      count: count(),
      documentBytes: sql`coalesce(sum(${table.documentBytes}), 0)`.mapWith(
        Number
      ),
      previewBytes: sql`coalesce(sum(${table.previewBytes}), 0)`.mapWith(
        Number
      ),
      awaitingCheck:
        sql`count(*) filter (where ${awaitingCheck(table, analysisRuns)})`.mapWith(
          Number
        ),
      parked:
        sql`count(*) filter (where ${table.analyzedDigest} is distinct from ${table.textDigest} and ${table.analysisAttemptDigest} = ${table.textDigest} and ${table.analysisAttempts} >= ${MAX_ANALYSIS_ATTEMPTS})`.mapWith(
          Number
        )
    })
    .from(table)
    .where(ne(table.userId, EXAMPLES_ACCOUNT_ID))
    .groupBy(table.visibility, hidden);

  const kind = kindOf(table);
  return rows.map((row) => ({ ...row, kind }));
}
