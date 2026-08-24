import { Inject, Injectable, Logger } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../config/env';

/**
 * Which tree a kind of asset lives in, under the storage root. The name is also
 * the URL prefix the static layer serves it from, so an avatar written to
 * `profile/…` is reachable at `/profile/…`.
 */
export type StorageArea = 'profile' | 'preview';

/** One file inside an asset directory. */
export interface AssetFile {
  /** Name within the directory, extension included. */
  readonly name: string;
  readonly content: Buffer;
}

/**
 * Where an asset's files live, relative to the storage root.
 *
 * One directory per asset under a single two-hex shard. The shard is there
 * because a directory per asset otherwise moves the fan-out one level up, and
 * 256 of them bound it for the cost of two characters already in the id. It is
 * uniform only while ids are uuid v4 — a time-ordered v7 would make the prefix a
 * timestamp and funnel every write into one shard.
 */
export function assetPath(area: StorageArea, id: string): string {
  return `${area}/${id.slice(0, 2)}/${id}`;
}

/** Where a client reads one of an asset's files from. */
export function assetUrl(area: StorageArea, id: string, file: string): string {
  return `/${assetPath(area, id)}/${file}`;
}

/**
 * Assets on a volume, each in an immutably named directory of its own.
 *
 * Derived, browser-served binaries — avatars and previews — stay out of the
 * database: they are regenerable, they are read through `<img>`, and a static
 * server does that better than any application code. The row keeps the
 * directory's id, and replacing an asset means writing a new directory and
 * moving the pointer, which is what makes the URLs safe to cache forever and
 * makes a half-finished write unobservable — nothing can name the new directory
 * until the pointer moves.
 *
 * A directory rather than a file per asset because an asset *is* several files:
 * one per size and format. Deleting it then needs no knowledge of which, so the
 * variant matrix can grow or shrink without stranding what an older matrix
 * named — where a flat naming scheme would leave `remove` enumerating a matrix
 * it can only know the current version of.
 *
 * Nothing here mirrors the legacy `PersistedResource` lifecycle: no entity
 * hooks, no MD5 change detection, no rename-on-update dance. Write a directory,
 * store its id, delete the old one — and a periodic sweep, which can walk one
 * shard at a time, catches whatever a crash left behind.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly root: string;

  constructor(@Inject(ENV) env: Env) {
    this.root = resolve(env.STORAGE_DIR);
  }

  /**
   * Writes one asset's files into a fresh directory and answers its id.
   *
   * A failure part-way through takes the directory with it: it is unreachable
   * either way, since no row names it yet, but leaving it would make the sweep
   * do work that belongs here.
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
   * Deletes an asset with everything in it, tolerating its absence.
   *
   * A pointer that no longer resolves is the expected state after a crash
   * between write and update, and failing a request over it would help nobody.
   */
  async removeAsset(area: StorageArea, id: string): Promise<void> {
    // The id comes from a uuid column, so this can only fail on corruption or a
    // bug — but the tool below is recursive, and one that reaches an area root
    // would take every asset in it. Refusing is the cheap side of that
    // asymmetry: an orphan costs disk, a wrong delete costs data.
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

/** What {@link FileStorageService.writeAsset} names a directory: a uuid. */
const ASSET_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
