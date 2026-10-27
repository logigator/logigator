import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replaceDump } from './backup';

async function folderWith(...names: string[]): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'logigator-backups-'));
  for (const name of names) await writeFile(join(folder, name), name);
  return folder;
}

describe('replaceDump', () => {
  it('leaves the new dump alone in the folder', async () => {
    const folder = await folderWith(
      'before-old.dump',
      'before-stale.dump.partial'
    );

    const path = await replaceDump(folder, 'before-new.dump', (file) =>
      writeFile(file, 'new')
    );

    expect(await readdir(folder)).toEqual(['before-new.dump']);
    expect(await readFile(path, 'utf8')).toBe('new');
  });

  it('keeps the earlier dumps when the new one fails', async () => {
    const folder = await folderWith('before-old.dump');

    await expect(
      replaceDump(folder, 'before-new.dump', async (file) => {
        await writeFile(file, 'half');
        throw new Error('pg_dump failed');
      })
    ).rejects.toThrow('pg_dump failed');

    expect(await readdir(folder)).toEqual(['before-old.dump']);
  });
});
