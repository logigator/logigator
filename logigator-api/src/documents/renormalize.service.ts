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
  skipped: number;
  failed: number;
}

export interface RenormalizeResult {
  projects: RenormalizeReport;
  components: RenormalizeReport;
}

/** How many rows are held in memory at once. */
const BATCH = 100;

/**
 * Re-derives every stored document's encoding and its derived metadata. A
 * **format bump** deploys with this over `format_version < current`, keeping
 * the table at one version; a **re-extract** (`--all`) rebuilds the dependency
 * edges, counts and port surface, so those tables stay a cache rather than a
 * second source of truth. One job, since migrating a document changes what the
 * derived metadata should say.
 *
 * Three properties make it safe against a live database:
 *
 * - **`version` is not bumped, but it guards the write.** Rewriting an encoding
 *   is not a user edit — the read-time guard covers a client holding an older
 *   copy, and bumping would offer every placed instance a no-op update. In the
 *   `WHERE` so a save that landed first is skipped rather than reverted; a full
 *   rebuild is therefore a pass repeated until nothing is skipped.
 * - **One transaction per row**, so a failure costs one document rather than
 *   leaving the table half-converted.
 * - **Idempotent**, so a crashed run resumes by running it again.
 *
 * Strict mode, like every other write: the input is a document this server
 * already accepted, so one that no longer parses is worth reporting rather than
 * quietly rewriting.
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
          if (await this.rewriteProject(row)) report.rewritten += 1;
          else report.skipped += 1;
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
          if (await this.rewriteComponent(row)) report.rewritten += 1;
          else report.skipped += 1;
        } catch (error) {
          report.failed += 1;
          this.logger.error(`component ${row.id}: ${describe(error)}`);
        }
      }
    }

    return report;
  }

  /** `false` when the row was written while this pass was reading it. */
  private async rewriteProject(row: ProjectRow): Promise<boolean> {
    const ingested = this.documents.ingest(row.document, row.name);

    return this.db.transaction(async (tx) => {
      const [written] = await tx
        .update(projects)
        .set({
          document: ingested.document,
          formatVersion: ingested.formatVersion,
          componentCount: ingested.componentCount,
          wireCount: ingested.wireCount
        })
        .where(and(eq(projects.id, row.id), eq(projects.version, row.version)))
        .returning({ id: projects.id });
      if (!written) return false;

      await this.dependencies.replace(
        tx,
        PROJECT_EDGES,
        row.id,
        ingested.dependencies
      );
      return true;
    });
  }

  private async rewriteComponent(row: ComponentRow): Promise<boolean> {
    const ingested = this.documents.ingest(row.document, row.name);

    return this.db.transaction(async (tx) => {
      const [written] = await tx
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
        .where(
          and(eq(components.id, row.id), eq(components.version, row.version))
        )
        .returning({ id: components.id });
      if (!written) return false;

      await this.dependencies.replace(
        tx,
        COMPONENT_EDGES,
        row.id,
        ingested.dependencies
      );
      return true;
    });
  }
}

/**
 * Start of the keyset walk. Keyset, not `OFFSET`: rows are written while this
 * runs, and an offset walk over a shifting set skips and repeats.
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
  return { scanned: 0, rewritten: 0, skipped: 0, failed: 0 };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
