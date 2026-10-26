/**
 * Which tree a kind of asset lives in, under the storage root. The name is also
 * its URL segment, so an avatar written to `profile/…` is served from there.
 */
export type StorageArea = 'profile' | 'preview';

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
 * per area, so the origin serves the whole volume with a single static rule
 * and no area claims an address the website might answer.
 */
export const STORAGE_URL_PREFIX = '/files';

/** Where a client reads one of an asset's files from. */
export function assetUrl(area: StorageArea, id: string, file: string): string {
  return `${STORAGE_URL_PREFIX}/${assetPath(area, id)}/${file}`;
}
