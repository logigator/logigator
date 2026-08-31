import { Inject, Injectable, Logger } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../config/env';

/**
 * Which tree a kind of asset lives in, under the storage root. The name is also
 * its URL segment, so an avatar written to `profile/…` is served from there.
 */
export type StorageArea = 'profile' | 'preview';

/** One file inside an asset directory. */
export interface AssetFile {
  /** Name within the directory, extension included. */
  readonly name: string;
  readonly content: Buffer;
}

/**
 * Where an asset's files live, relative to the storage root: one directory per
 * asset under a two-hex shard that bounds the fan-out to 256. Uniform only
 * while ids are uuid v4 — a time-ordered v7 would funnel writes into one shard.
 */
export function assetPath(area: StorageArea, id: string): string {
  return `${area}/${id.slice(0, 2)}/${id}`;
}

/**
 * URL root the storage volume is served under: one root rather than one prefix
 * per area, because the legacy backend answers `/profile/…` and `/preview/…`
 * from its own disk on the same origin until cutover, and a static handler
 * matching `/profile/*` would swallow those requests.
 */
export const STORAGE_URL_PREFIX = '/files';

/** Where a client reads one of an asset's files from. */
export function assetUrl(area: StorageArea, id: string, file: string): string {
  return `${STORAGE_URL_PREFIX}/${assetPath(area, id)}/${file}`;
}

/**
 * Assets on a volume, each in an immutably named directory of its own. Avatars
 * and previews are regenerable and read through `<img>`, so a static server
 * handles them better than application code does.
 *
 * The row keeps only the directory's id. Replacing an asset writes a new
 * directory and moves the pointer, which makes the URLs cacheable forever and a
 * half-finished write unnameable. A directory rather than a file because an
 * asset *is* several files, one per size and format: deleting needs no
 * knowledge of which, so the variant matrix can change without stranding what
 * an older one named. A periodic sweep collects what a crash left behind.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly root: string;

  constructor(@Inject(ENV) env: Env) {
    this.root = resolve(env.STORAGE_DIR);
  }

  /**
   * Writes one asset's files into a fresh directory and answers its id. A
   * failure part-way through takes the directory with it, rather than leaving
   * the sweep work that belongs here.
   */
  async writeAsset(
    area: StorageArea,
    files: readonly AssetFile[]
  ): Promise<string> {
    const id = randomUUID();
    const directory = join(this.root, assetPath(area, id));
    await mkdir(directory, { recursive: true });

    try {
      await Promise.all(
        files.map((file) => writeFile(join(directory, file.name), file.content))
      );
    } catch (error) {
      await this.removeAsset(area, id);
      throw error;
    }

    return id;
  }

  /**
   * Deletes an asset with everything in it, tolerating its absence: a pointer
   * that no longer resolves is the expected state after a crash between write
   * and update.
   */
  async removeAsset(area: StorageArea, id: string): Promise<void> {
    // The delete below is recursive, so an id that reached an area root would
    // take every asset in it. An orphan costs disk; a wrong delete costs data.
    if (!ASSET_ID.test(id)) {
      this.logger.warn(`Refusing to delete suspicious asset id: ${id}`);
      return;
    }

    await rm(join(this.root, assetPath(area, id)), {
      recursive: true,
      force: true
    });
  }
}

/** The uuid `writeAsset` names a directory with. */
const ASSET_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
