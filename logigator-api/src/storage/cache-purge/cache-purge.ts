import type { Env } from '../../config/env';
import { CloudflareCachePurge } from './cloudflare-cache-purge';

/** What one purge request came to. A failure is retried, whatever it was. */
export type PurgeOutcome = { ok: true } | { ok: false; reason: string };

/**
 * The CDN in front of the origin, asked to drop its copies of files by exact,
 * absolute URL. Nothing else about a provider leaks past this: the origin
 * states the edge lifetime in `CDN-Cache-Control`, which every CDN reads, so a
 * provider is only the way its purge API is called.
 */
export interface CachePurge {
  /** Named in the log when a purge fails. */
  readonly name: string;
  /** The most URLs one {@link purge} may be handed. */
  readonly batchSize: number;
  purge(urls: readonly string[]): Promise<PurgeOutcome>;
}

export const CACHE_PURGE = Symbol('CACHE_PURGE');

/** No CDN holds `/files`, so there is nothing to purge. */
export const noCachePurge: CachePurge = {
  name: 'none',
  batchSize: 100,
  purge: () => Promise.resolve({ ok: true })
};

export function createCachePurge(env: Env): CachePurge {
  switch (env.CACHE_PURGE_PROVIDER) {
    case 'none':
      return noCachePurge;
    case 'cloudflare':
      if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN) {
        throw new Error(
          'Purging through Cloudflare needs CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN.'
        );
      }
      return new CloudflareCachePurge({
        zoneId: env.CLOUDFLARE_ZONE_ID,
        apiToken: env.CLOUDFLARE_API_TOKEN
      });
  }
}
