import { execFile } from 'node:child_process';
import { readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

/**
 * Writes a new dump into `directory` through `write`, then deletes everything
 * else there. The dump is written under a temporary name and renamed once
 * complete, so a write that fails leaves the earlier dumps as they were and no
 * half-written file that looks like a dump.
 *
 * @returns the new dump's path.
 */
export async function replaceDump(
  directory: string,
  fileName: string,
  write: (path: string) => Promise<void>
): Promise<string> {
  const path = join(directory, fileName);
  const partial = `${path}.partial`;
  try {
    await write(partial);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
  await rename(partial, path);

  const others = (await readdir(directory)).filter((name) => name !== fileName);
  await Promise.all(
    others.map((name) =>
      rm(join(directory, name), { recursive: true, force: true })
    )
  );
  return path;
}

/**
 * `pg_dump` in its custom format, the one `pg_restore` reads. It refuses a
 * server of a newer major version than its own, which fails the dump loudly.
 */
export async function pgDump(databaseUrl: string, file: string): Promise<void> {
  await promisify(execFile)('pg_dump', [
    '--format=custom',
    `--file=${file}`,
    `--dbname=${databaseUrl}`
  ]);
}
