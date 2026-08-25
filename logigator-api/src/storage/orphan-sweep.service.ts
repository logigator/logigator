import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isNotNull } from 'drizzle-orm';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import { components, projects, users } from '../database/schema';
import { FileStorageService, type StorageArea } from './file-storage.service';

/** What the sweep found and did, so a run is legible in the log. */
export interface SweepReport {
  scanned: number;
  removed: number;
  /** Directories left alone for being younger than the grace window. */
  spared: number;
}

/**
 * Deletes asset directories no row points at.
 *
 * There is no lifecycle machinery keeping the volume and the database in step —
 * no entity hooks, no rename-on-update — because the write path deliberately
 * does not need any: it writes a new directory and moves a pointer, and the old
 * directory is deleted after. What that leaves behind is a crash between those
 * two steps, and a periodic sweep is the whole answer to it. An orphan costs
 * disk; the alternative designs cost correctness.
 *
 * Two rules make it safe to run at any time. It only ever considers a directory
 * whose name is a uuid in a two-character shard, so nothing outside the shape the
 * write path produces is a candidate. And it spares anything younger than the
 * grace window: an upload in flight is a directory no row names *yet*, which is
 * indistinguishable from an orphan except by age.
 */
@Injectable()
export class OrphanSweepService {
  private readonly logger = new Logger(OrphanSweepService.name);
  private readonly root: string;
  private readonly graceMs: number;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(DB) private readonly db: Database,
    private readonly files: FileStorageService
  ) {
    this.root = resolve(env.STORAGE_DIR);
    this.graceMs = env.STORAGE_SWEEP_GRACE_MINUTES * 60_000;
  }

  /**
   * Nightly, and off-peak: the work is proportional to what is on the volume,
   * not to what happened that day, and nothing depends on an orphan going away
   * promptly.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduled(): Promise<void> {
    for (const area of ['profile', 'preview'] as const) {
      try {
        const report = await this.sweep(area);
        if (report.removed > 0 || report.spared > 0) {
          this.logger.log(
            `Swept ${area}: ${report.removed} orphaned of ${report.scanned}, ${report.spared} too new to judge`
          );
        }
      } catch (error) {
        // A sweep that fails is a sweep that runs again tomorrow; it must not
        // take the process with it.
        this.logger.error(`Sweeping ${area} failed`, error);
      }
    }
  }

  /** One area, from the referenced set down to the deletions. */
  async sweep(area: StorageArea): Promise<SweepReport> {
    const referenced = await this.referenced(area);
    const cutoff = Date.now() - this.graceMs;
    const report: SweepReport = { scanned: 0, removed: 0, spared: 0 };

    for (const shard of await this.entries(this.root, area)) {
      if (!SHARD.test(shard)) continue;

      for (const id of await this.entries(this.root, area, shard)) {
        if (!ASSET_ID.test(id) || !id.startsWith(shard)) continue;
        report.scanned += 1;
        if (referenced.has(id)) continue;

        // Read after the pointer lookup, never before: a directory created since
        // that query is exactly the in-flight upload the window protects.
        const created = await this.createdAt(join(area, shard, id));
        if (created === null || created > cutoff) {
          report.spared += 1;
          continue;
        }

        await this.files.removeAsset(area, id);
        report.removed += 1;
      }
    }

    return report;
  }

  /**
   * Every id a row currently names in this area.
   *
   * Read whole rather than checked per directory: the columns are narrow, the
   * scan is one statement instead of one per asset, and a set read *before* the
   * volume walk can only be missing ids the grace window then spares.
   */
  private async referenced(area: StorageArea): Promise<Set<string>> {
    if (area === 'profile') {
      const rows = await this.db
        .select({ id: users.avatarId })
        .from(users)
        .where(isNotNull(users.avatarId));
      return ids(rows);
    }

    const [projectRows, componentRows] = await Promise.all([
      this.db
        .select({ id: projects.previewId })
        .from(projects)
        .where(isNotNull(projects.previewId)),
      this.db
        .select({ id: components.previewId })
        .from(components)
        .where(isNotNull(components.previewId))
    ]);
    return ids([...projectRows, ...componentRows]);
  }

  private async entries(...segments: string[]): Promise<string[]> {
    try {
      return await readdir(join(...segments));
    } catch {
      // An area with nothing in it yet has no directory, which is not a problem
      // to report — it is what an empty volume looks like.
      return [];
    }
  }

  private async createdAt(relative: string): Promise<number | null> {
    try {
      // `mtime`, not `birthtime`: the latter is unavailable on some filesystems
      // and reads as the epoch there, which would make every directory look
      // ancient and sweep an upload out from under itself.
      return (await stat(join(this.root, relative))).mtimeMs;
    } catch {
      return null;
    }
  }
}

function ids(rows: readonly { id: string | null }[]): Set<string> {
  return new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));
}

const SHARD = /^[0-9a-f]{2}$/;
const ASSET_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
