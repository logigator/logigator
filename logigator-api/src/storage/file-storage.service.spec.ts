import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { Env } from '../config/env';
import {
  assetPath,
  assetUrl,
  FileStorageService
} from './file-storage.service';

describe('the asset layout', () => {
  const id = 'a3f1c2d4-1111-4222-8333-444455556666';

  /**
   * The shard keeps any single directory small enough for a sweep to walk. Two
   * hex characters of a v4 uuid distribute uniformly across 256 of them.
   */
  it('shards an asset under the first two characters of its own id', () => {
    expect(assetPath('profile', id)).toBe(`profile/a3/${id}`);
    expect(assetUrl('preview', id, 'light-256.webp')).toBe(
      `/files/preview/a3/${id}/light-256.webp`
    );
  });

  /**
   * One root for the whole volume, not one prefix per area: the legacy backend
   * answers `/profile/…` and `/preview/…` from its own disk on the same origin
   * until cutover, and a handler on those prefixes would swallow its requests.
   */
  it('serves every area under one url root', () => {
    expect(assetUrl('profile', id, '64.webp')).toMatch(/^\/files\//);
    expect(assetUrl('preview', id, 'dark-256.webp')).toMatch(/^\/files\//);
  });
});

describe('FileStorageService', () => {
  let root: string;
  let files: FileStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'logigator-storage-'));
    files = new FileStorageService({ STORAGE_DIR: root } as Env);
    // The refusal below logs; a passing suite should not read like a failure.
    vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it('writes an asset where its id says it is, and deletes all of it', async () => {
    const id = await files.writeAsset('profile', [
      { name: '64.webp', content: Buffer.from('small') },
      { name: '256.webp', content: Buffer.from('large') }
    ]);

    const directory = join(root, assetPath('profile', id));
    expect((await readdir(directory)).sort()).toEqual(['256.webp', '64.webp']);

    await files.removeAsset('profile', id);
    await expect(readdir(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  /**
   * Deleting takes the directory, not the files it knows about, so the variant
   * matrix can change without stranding what an older one named.
   */
  it('deletes files it never wrote, along with the rest of the asset', async () => {
    const id = await files.writeAsset('profile', [
      { name: '64.webp', content: Buffer.from('current') }
    ]);
    const directory = join(root, assetPath('profile', id));
    await writeFile(join(directory, '512.avif'), 'from an older matrix');

    await files.removeAsset('profile', id);

    await expect(readdir(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  /**
   * The delete is recursive, so a bad id would take a shard or an entire area
   * with it rather than fail.
   */
  it.each(['..', '.', 'a3/../..', '', 'not-a-uuid'])(
    'refuses to delete the id %o',
    async (suspicious) => {
      const id = await files.writeAsset('profile', [
        { name: '64.webp', content: Buffer.from('keep me') }
      ]);
      await files.removeAsset('profile', suspicious);

      expect(await readdir(join(root, assetPath('profile', id)))).toEqual([
        '64.webp'
      ]);
    }
  );

  /**
   * A half-written asset is unnameable either way, but leaving it hands the
   * sweep work that belongs to the writer.
   */
  it('leaves nothing behind when a write fails part-way', async () => {
    await expect(
      files.writeAsset('profile', [
        { name: '64.webp', content: Buffer.from('fine') },
        { name: 'nested/256.webp', content: Buffer.from('no such directory') }
      ])
    ).rejects.toMatchObject({ code: 'ENOENT' });

    // The shard survives, being shared; no asset directory under it does.
    const shards = await readdir(join(root, 'profile'));
    for (const shard of shards) {
      expect(await readdir(join(root, 'profile', shard))).toEqual([]);
    }
  });
});
