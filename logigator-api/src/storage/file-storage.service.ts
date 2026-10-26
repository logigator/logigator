import { Inject, Injectable, Logger } from '@nestjs/common';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../config/env';
import { CachePurgeQueue } from './cache-purge/cache-purge-queue';
import { assetPath, type StorageArea } from './storage-layout';

export {
  assetPath,
  assetUrl,
  STORAGE_URL_PREFIX,
  type StorageArea
} from './storage-layout';

/** One file inside an asset directory. */
export interface AssetFile {
  /** Name within the directory, extension included. */
  readonly name: string;
  readonly content: Buffer;
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
 *
 * Every file of a removed asset is queued for a purge from the CDN first, so
 * an edge may hold the URLs for as long as it likes.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly root: string;

  constructor(
    @Inject(ENV) env: Env,
    private readonly purges: CachePurgeQueue
  ) {
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
      await this.discard(area, id);
      throw error;
    }

    return id;
  }

  /**
   * Copies an asset into a fresh directory and answers the copy's id, or `null`
   * where the source is not there. A copy rather than a second pointer at the
   * same directory: replacing either row's asset deletes the directory it
   * names, which would take the other's with it.
   */
  async copyAsset(area: StorageArea, id: string): Promise<string | null> {
    if (!ASSET_ID.test(id)) return null;

    const copy = randomUUID();
    const directory = join(this.root, assetPath(area, copy));
    await mkdir(join(directory, '..'), { recursive: true });

    try {
      await cp(join(this.root, assetPath(area, id)), directory, {
        recursive: true,
        errorOnExist: true,
        force: false
      });
    } catch (error) {
      await this.discard(area, copy);
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }

    return copy;
  }

  /**
   * One file out of an asset, or `null` where it is not there. Reading is what
   * the share card needs and nothing else does — every other consumer is a
   * client following a URL the static layer serves — so absence is an answer
   * rather than an error: a row may point at a directory a crash left
   * half-written, and a card composes without the picture.
   */
  async readAsset(
    area: StorageArea,
    id: string,
    file: string
  ): Promise<Buffer | null> {
    if (!ASSET_ID.test(id)) return null;

    try {
      return await readFile(join(this.root, assetPath(area, id), file));
    } catch {
      return null;
    }
  }

  /**
   * Deletes an asset with everything in it, tolerating its absence: a pointer
   * that no longer resolves is the expected state after a crash between write
   * and update. The files are queued for a purge before they are unlinked, and
   * a failure to queue never fails the deletion.
   */
  async removeAsset(area: StorageArea, id: string): Promise<void> {
    // The delete below is recursive, so an id that reached an area root would
    // take every asset in it. An orphan costs disk; a wrong delete costs data.
    if (!ASSET_ID.test(id)) {
      this.logger.warn(`Refusing to delete suspicious asset id: ${id}`);
      return;
    }

    const directory = assetPath(area, id);
    const names = await readdir(join(this.root, directory)).catch(
      (): string[] => []
    );
    try {
      await this.purges.enqueue(names.map((name) => `${directory}/${name}`));
    } catch (error) {
      // The deletion stands either way; the URLs then need purging by hand.
      this.logger.error(
        `Queueing the cache purge of ${directory} failed: ${names.join(', ')}`,
        error
      );
    }

    await this.discard(area, id);
  }

  /** Deletes an asset no client was ever given a URL of. */
  private async discard(area: StorageArea, id: string): Promise<void> {
    await rm(join(this.root, assetPath(area, id)), {
      recursive: true,
      force: true
    });
  }
}

/** The uuid `writeAsset` names a directory with. */
const ASSET_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
