import { describe, expect, it } from 'vitest';
import { CloudflareCachePurge } from './cloudflare-cache-purge';

function answering(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
      })
    );
  };
  return { requests, fetch: fetch as typeof globalThis.fetch };
}

const URLS = [
  'https://logigator.com/files/profile/a3/a3f1/64.webp',
  'https://logigator.com/files/profile/a3/a3f1/64.jpg'
];

describe('CloudflareCachePurge', () => {
  it('purges the URLs by file in the zone, with the token as bearer', async () => {
    const { requests, fetch } = answering(200, {
      success: true,
      errors: [],
      messages: [],
      result: { id: 'purge' }
    });
    const purge = new CloudflareCachePurge({
      zoneId: 'zone-id',
      apiToken: 'token',
      fetch
    });

    expect(await purge.purge(URLS)).toEqual({ ok: true });

    expect(requests).toHaveLength(1);
    const [{ url, init }] = requests;
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone-id/purge_cache'
    );
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
    expect(JSON.parse(init.body as string)).toEqual({ files: URLS });
  });

  it('fails on an error, including one under a 200', async () => {
    const limited = new CloudflareCachePurge({
      zoneId: 'zone',
      apiToken: 'token',
      fetch: answering(429, {
        success: false,
        errors: [
          { code: 1134, message: 'Unable to purge, rate limit reached.' }
        ]
      }).fetch
    });
    expect(await limited.purge(URLS)).toEqual({
      ok: false,
      reason:
        'Cloudflare answered 429: 1134 Unable to purge, rate limit reached.'
    });

    const unsuccessful = new CloudflareCachePurge({
      zoneId: 'zone',
      apiToken: 'token',
      fetch: answering(200, { success: false, errors: [] }).fetch
    });
    expect(await unsuccessful.purge(URLS)).toMatchObject({ ok: false });
  });

  it('fails when Cloudflare cannot be reached', async () => {
    const purge = new CloudflareCachePurge({
      zoneId: 'zone',
      apiToken: 'token',
      fetch: () => Promise.reject(new TypeError('fetch failed'))
    });

    expect(await purge.purge(URLS)).toMatchObject({ ok: false });
  });

  it('refuses more URLs than one request may carry', async () => {
    const purge = new CloudflareCachePurge({
      zoneId: 'zone',
      apiToken: 'token',
      fetch: answering(200, { success: true }).fetch
    });

    await expect(
      purge.purge(Array.from({ length: 101 }, (_, i) => `${URLS[0]}?${i}`))
    ).rejects.toThrow(/at most 100/);
  });
});
