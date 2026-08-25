import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, gt, lt, type SQL } from 'drizzle-orm';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import { DB, type Database } from '../database/database.module';
import {
  components,
  projects,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';
import { CircuitDocumentService } from './circuit-document.service';
import {
  COMPONENT_EDGES,
  DependenciesService,
  PROJECT_EDGES
} from './dependencies.service';

/** What one pass did to one table. */
export interface RenormalizeReport {
  scanned: number;
  rewritten: number;
  failed: number;
}

/** Both tables, named rather than keyed, so a caller reads a field. */
export interface RenormalizeResult {
  projects: RenormalizeReport;
  components: RenormalizeReport;
}

/** How many rows are held in memory at once. */
const BATCH = 100;

/**
 * Re-derives every stored document's encoding and its derived metadata.
 *
 * Two jobs that are one job. A **format bump** deploys with this over the rows
 * an older version wrote (`format_version < current`), which is what keeps
 * normalize-on-write true: the table only ever holds one version, so revisions
 * stay diffable and a collaboration snapshot is uniform. And a **re-extract**
 * runs it over everything, rebuilding the dependency edges, the counts and the
 * port surface from the documents they were derived from — the admin command that
 * makes those tables a cache rather than a second source of truth.
 *
 * They are the same work because migrating a document changes what the derived
 * metadata should say, so a format bump has to re-extract anyway.
 *
 * Three properties make it safe to run against a live database:
 *
 * - **`version` is not bumped.** Rewriting an encoding is not a user edit. A
 *   client holding a pre-rewrite copy is covered by the read-time guard, and
 *   bumping the counter here would offer every placed instance of every
 *   component an update that changes nothing about it.
 * - **One transaction per row**, so a failure costs one document and the pass
 *   keeps going. A row that cannot be parsed is reported and left exactly as it
 *   was — the alternative is a job that stops on the first bad row and leaves the
 *   table half-converted.
 * - **Idempotent**, so a crashed run is resumed by running it again. The
 *   format-bump pass resumes for free, since a converted row no longer matches
 *   its predicate.
 *
 * Strict mode, like every other write. The lenient parse exists for the one-time
 * migration of the legacy database, where junk has to be salvaged; here the input
 * is a document this server already accepted, and one that no longer parses is
 * something to be told about rather than to quietly rewrite.
 */
@Injectable()
export class RenormalizeService {
  private readonly logger = new Logger('Renormalize');

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly documents: CircuitDocumentService,
    private readonly dependencies: DependenciesService
  ) {}

  /**
   * @param all `false` rewrites only what an older format version wrote — the
   * format-bump pass. `true` rewrites everything, rebuilding the derived tables.
   */
  async run(all: boolean): Promise<RenormalizeResult> {
    return {
      projects: await this.runProjects(all),
      components: await this.runComponents(all)
    };
  }

  private async runProjects(all: boolean): Promise<RenormalizeReport> {
    const report = blank();
    let after = EMPTY_UUID;

    for (;;) {
      const batch = await this.db
        .select()
        .from(projects)
        .where(and(gt(projects.id, after), stale(projects.formatVersion, all)))
        .orderBy(asc(projects.id))
        .limit(BATCH);
      if (batch.length === 0) break;
      after = batch[batch.length - 1].id;

      for (const row of batch) {
        report.scanned += 1;
        try {
          await this.rewriteProject(row);
          report.rewritten += 1;
        } catch (error) {
          report.failed += 1;
          this.logger.error(`project ${row.id}: ${describe(error)}`);
        }
      }
    }

    return report;
  }

  private async runComponents(all: boolean): Promise<RenormalizeReport> {
    const report = blank();
    let after = EMPTY_UUID;

    for (;;) {
      const batch = await this.db
        .select()
        .from(components)
        .where(
          and(gt(components.id, after), stale(components.formatVersion, all))
        )
        .orderBy(asc(components.id))
        .limit(BATCH);
      if (batch.length === 0) break;
      after = batch[batch.length - 1].id;

      for (const row of batch) {
        report.scanned += 1;
        try {
          await this.rewriteComponent(row);
          report.rewritten += 1;
        } catch (error) {
          report.failed += 1;
          this.logger.error(`component ${row.id}: ${describe(error)}`);
        }
      }
    }

    return report;
  }

  private async rewriteProject(row: ProjectRow): Promise<void> {
    const ingested = this.documents.ingest(row.document, row.name);

    await this.db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          document: ingested.document,
          formatVersion: ingested.formatVersion,
          componentCount: ingested.componentCount,
          wireCount: ingested.wireCount
        })
        .where(eq(projects.id, row.id));

      await this.dependencies.replace(
        tx,
        PROJECT_EDGES,
        row.id,
        ingested.dependencies
      );
    });
  }

  private async rewriteComponent(row: ComponentRow): Promise<void> {
    const ingested = this.documents.ingest(row.document, row.name);

    await this.db.transaction(async (tx) => {
      await tx
        .update(components)
        .set({
          document: ingested.document,
          formatVersion: ingested.formatVersion,
          componentCount: ingested.componentCount,
          wireCount: ingested.wireCount,
          numInputs: ingested.summary.numInputs,
          numOutputs: ingested.summary.numOutputs,
          labels: ingested.summary.labels
        })
        .where(eq(components.id, row.id));

      await this.dependencies.replace(
        tx,
        COMPONENT_EDGES,
        row.id,
        ingested.dependencies
      );
    });
  }
}

/**
 * Keyset pagination, not `OFFSET`: rows are being written while this runs, and an
 * offset walk over a shifting set skips and repeats. Ordering by the primary key
 * and remembering where it got to cannot.
 */
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

/** The format-bump predicate, or none at all for a full re-extract. */
function stale(
  formatVersion: Parameters<typeof lt>[0],
  all: boolean
): SQL | undefined {
  return all ? undefined : lt(formatVersion, CURRENT_FILE_VERSION);
}

function blank(): RenormalizeReport {
  return { scanned: 0, rewritten: 0, failed: 0 };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
