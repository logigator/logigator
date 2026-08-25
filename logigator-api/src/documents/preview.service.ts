import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module';
import {
  components,
  projects,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';
import { FileStorageService } from '../storage/file-storage.service';
import { ImageService } from '../storage/image.service';
import { circuitNotFound } from './circuit-errors';
import type { CircuitRow, CircuitTable } from './circuit-queries';
import { findOwned } from './circuit-queries';
import type { PreviewSources } from './preview-upload';

/**
 * A stored circuit's preview: written by the editor, served as files.
 *
 * Shared between both kinds rather than written twice, because what matters here
 * is an ordering and orderings are what duplication gets wrong. Nothing is
 * written until the renders have been decoded and re-encoded, so an unusable
 * upload changes nothing; the pointer moves before the asset it replaces is
 * deleted, so a failed unlink leaves an orphan for the sweep rather than a row
 * pointing at nothing; and a fresh asset the pointer never reached is removed
 * again, since no row can name it.
 *
 * A preview is not content, so writing one does not touch `version` or the
 * edit time. It is a picture of the circuit, not a change to it — and for a
 * component that same counter is what offers a placed instance an update.
 */
@Injectable()
export class PreviewService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly images: ImageService,
    private readonly files: FileStorageService
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

    const row = await this.point(table, userId, id, previewId);
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

    const row = await this.point(table, userId, id, null);
    if (!row) throw circuitNotFound(kindOf(table));

    await this.files.removeAsset('preview', existing.previewId);
    return row;
  }

  private async point(
    table: CircuitTable,
    userId: string,
    id: string,
    previewId: string | null
  ): Promise<CircuitRow | null> {
    const [row] = await this.db
      .update(table)
      .set({ previewId })
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

function kindOf(table: CircuitTable): 'project' | 'component' {
  return table === projects ? 'project' : 'component';
}
