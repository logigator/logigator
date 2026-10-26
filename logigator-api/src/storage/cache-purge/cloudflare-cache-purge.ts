import type { CachePurge, PurgeOutcome } from './cache-purge';

export interface CloudflareCachePurgeOptions {
  zoneId: string;
  /** A token with the zone's Cache Purge permission and nothing else. */
  apiToken: string;
  fetch?: typeof fetch;
}

const API_BASE_URL = 'https://api.cloudflare.com/client/v4';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Purge by URL (`files`), which every plan has. 100 URLs a request is the
 * ceiling on every plan below Enterprise, and the Free plan's rate limit is
 * 800 URLs a second.
 */
export class CloudflareCachePurge implements CachePurge {
  readonly name = 'cloudflare';
  readonly batchSize = 100;

  private readonly fetch: typeof fetch;

  constructor(private readonly options: CloudflareCachePurgeOptions) {
    this.fetch = options.fetch ?? fetch;
  }

  async purge(urls: readonly string[]): Promise<PurgeOutcome> {
    if (urls.length > this.batchSize) {
      throw new Error(
        `A Cloudflare purge takes at most ${this.batchSize} URLs, not ${urls.length}.`
      );
    }

    let response: Response;
    try {
      response = await this.fetch(
        `${API_BASE_URL}/zones/${encodeURIComponent(this.options.zoneId)}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.options.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: urls }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
      );
    } catch (error) {
      return { ok: false, reason: `Cloudflare unreachable: ${String(error)}` };
    }

    const body = (await response.json().catch(() => null)) as {
      success?: unknown;
      errors?: { code?: unknown; message?: unknown }[];
    } | null;
    // `success` is the verdict: an error can arrive under a 200.
    if (response.ok && body?.success === true) return { ok: true };

    const errors = Array.isArray(body?.errors)
      ? body.errors
          .map((error) => `${String(error.code)} ${String(error.message)}`)
          .join('; ')
      : '';
    return {
      ok: false,
      reason: `Cloudflare answered ${response.status}${errors ? `: ${errors.slice(0, 300)}` : ''}`
    };
  }
}
