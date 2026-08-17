import { Inject, Injectable, Logger } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../config/env';

/**
 * Which directory a kind of file lives in, under the storage root. The name is
 * also the URL prefix the static layer serves it from, so `profile/abc.png` is
 * reachable at `/profile/abc.png`.
 */
export type StorageArea = 'profile' | 'preview';

/** The image types accepted for user-supplied files, and their extensions. */
const EXTENSION_BY_TYPE = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp']
]);

export function extensionForImageType(mimeType: string): string | null {
  return EXTENSION_BY_TYPE.get(mimeType.toLowerCase()) ?? null;
}

/**
 * Files on a volume, addressed by an immutable random name.
 *
 * Derived, browser-served binaries — avatars now, previews next — stay out of the
 * database: they are regenerable, they are read through `<img>`, and a static
 * server does that better than any application code. The row keeps the filename,
 * and replacing a file means writing a new name and updating the pointer, which
 * is what makes the URL safe to cache forever and makes a half-finished write
 * unobservable.
 *
 * Nothing here mirrors the legacy `PersistedResource` lifecycle: no entity hooks,
 * no MD5 change detection, no rename-on-update dance. Write a file, store its
 * name, delete the old one — and a periodic sweep catches whatever a crash left
 * behind.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly root: string;

  constructor(@Inject(ENV) env: Env) {
    this.root = resolve(env.STORAGE_DIR);
  }

  /**
   * Writes `content` under a fresh name and answers that name. The extension is
   * kept so the static server can infer a content type.
   */
  async write(
    area: StorageArea,
    content: Buffer,
    extension: string
  ): Promise<string> {
    const filename = `${randomUUID()}${extension}`;
    const directory = join(this.root, area);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), content);
    return filename;
  }

  /**
   * Deletes a file, tolerating its absence.
   *
   * A pointer that no longer resolves is the expected state after a crash
   * between write and update, and failing a request over it would help nobody.
   */
  async remove(area: StorageArea, filename: string): Promise<void> {
    // The name comes from a database column, but a path separator or a `..` in
    // it would still escape the area — cheap to rule out, fatal to assume.
    if (!STORED_NAME.test(filename)) {
      this.logger.warn(`Refusing to delete suspicious filename: ${filename}`);
      return;
    }

    try {
      await unlink(join(this.root, area, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

/** What {@link FileStorageService.write} produces: a uuid and an extension. */
const STORED_NAME = /^[\w-]+\.[a-z]{3,4}$/;
