import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database, type Queryable } from '../database/database.module';
import {
  components,
  projects,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';
import { FileStorageService } from '../storage/file-storage.service';
import { ImageService } from '../storage/image.service';
import { circuitNotFound } from './circuit-errors';
import { type CircuitRow, type CircuitTable, kindOf } from './circuit-queries';
import { findOwned } from './circuit-queries';
import type { PreviewSources } from './preview-upload';
import { StorageQuotaService } from './storage-quota.service';

/**
 * A stored circuit's preview: written by the editor, served as files. Shared
 * between both kinds because what matters is an ordering, and orderings are
 * what duplication gets wrong. Nothing is written until the renders decode and
 * re-encode; the pointer moves before the old asset is deleted, so a failed
 * unlink leaves an orphan for the sweep rather than a dangling row; and an
 * asset the pointer never reached is removed again.
 *
 * A preview is a picture of the circuit, not a change to it, so writing one
 * leaves `version` and the edit time alone. Its files count against the
 * owner's storage quota all the same, and a replacement that would take the
 * account past it is refused, leaving the old preview in place.
 */
@Injectable()
export class PreviewService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly images: ImageService,
    private readonly files: FileStorageService,
    private readonly quota: StorageQuotaService
  ) {}

  replace(
    table: typeof projects,
    userId: string,
    id: string,
    sources: PreviewSources
  ): Promise<ProjectRow>;
  replace(
    table: typeof components,
    userId: string,
    id: string,
    sources: PreviewSources
  ): Promise<ComponentRow>;
  async replace(
    table: CircuitTable,
    userId: string,
    id: string,
    sources: PreviewSources
  ): Promise<CircuitRow> {
    const existing = await this.require(table, userId, id);
    const files = await this.images.encodePreviews(sources);
    const previewId = await this.files.writeAsset('preview', files);
    const previewBytes = files.reduce(
      (sum, file) => sum + file.content.byteLength,
      0
    );

    let row: CircuitRow | null;
    try {
      row = await this.db.transaction((tx) =>
        this.quota.guard(tx, userId, () =>
          this.point(tx, table, userId, id, previewId, previewBytes)
        )
      );
    } catch (error) {
      await this.files.removeAsset('preview', previewId);
      throw error;
    }
    if (!row) {
      // Deleted between the check and the write; nothing names the new asset.
      await this.files.removeAsset('preview', previewId);
      throw circuitNotFound(kindOf(table));
    }

    if (existing.previewId) {
      await this.files.removeAsset('preview', existing.previewId);
    }
    return row;
  }

  clear(
    table: typeof projects,
    userId: string,
    id: string
  ): Promise<ProjectRow>;
  clear(
    table: typeof components,
    userId: string,
    id: string
  ): Promise<ComponentRow>;
  async clear(
    table: CircuitTable,
    userId: string,
    id: string
  ): Promise<CircuitRow> {
    const existing = await this.require(table, userId, id);
    if (!existing.previewId) return existing;

    const row = await this.point(this.db, table, userId, id, null, 0);
    if (!row) throw circuitNotFound(kindOf(table));

    await this.files.removeAsset('preview', existing.previewId);
    return row;
  }

  private async point(
    db: Queryable,
    table: CircuitTable,
    userId: string,
    id: string,
    previewId: string | null,
    previewBytes: number
  ): Promise<CircuitRow | null> {
    const [row] = await db
      .update(table)
      .set({ previewId, previewBytes })
      .where(and(eq(table.id, id), eq(table.userId, userId)))
      .returning();
    return row ?? null;
  }

  private async require(
    table: CircuitTable,
    userId: string,
    id: string
  ): Promise<CircuitRow> {
    const row =
      table === projects
        ? await findOwned(this.db, projects, userId, id)
        : await findOwned(this.db, components, userId, id);
    if (!row) throw circuitNotFound(kindOf(table));
    return row;
  }
}
