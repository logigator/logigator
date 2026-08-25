import { join } from 'node:path';
import { STORAGE_URL_PREFIX } from '../src/storage/file-storage.service';
import type { E2eApp } from './harness';

/**
 * Where on the volume a served URL resolves to.
 *
 * The two are not the same string: the whole volume is served under a URL root
 * of its own, which the static layer strips. Going through the exported constant
 * means a spec cannot quietly assert the old shape after that root moves.
 */
export function assetFilePath(app: E2eApp, url: string): string {
  return join(app.env.STORAGE_DIR, url.slice(STORAGE_URL_PREFIX.length));
}

/** The asset id out of one of its variant URLs. */
export function assetIdOf(url: string): string {
  const segments = url.slice(STORAGE_URL_PREFIX.length + 1).split('/');
  // `{area}/{shard}/{id}/{file}`
  return segments[2];
}
