import { describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';
import { ApiException } from '../common/api-exception';
import { Metrics } from '../metrics/metrics';
import { SITEVERIFY_URL, TurnstileService } from './turnstile.service';

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** A `fetch` answering every call with `answer`, recording what was sent. */
function fakeFetch(answer: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return answer();
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const reply =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

const ACCEPTED = {
  success: true,
  hostname: 'logigator.com',
  action: 'register',
  'error-codes': []
};

function service(
  fetch: typeof globalThis.fetch,
  secret: string | null = 'turnstile-secret'
) {
  const env = loadEnv({
    PUBLIC_URL: 'https://logigator.com',
    ...(secret
      ? { TURNSTILE_SECRET_KEY: secret, TURNSTILE_SITE_KEY: 'turnstile-site' }
      : {})
  });
  return new TurnstileService(env, fetch, new Metrics());
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  if (!(error instanceof ApiException)) throw new Error('not refused');
  return `${error.getStatus()} ${error.code}`;
}

describe('TurnstileService', () => {
  it('lets everything through without a secret, and never calls out', async () => {
    const { fetch, calls } = fakeFetch(reply(ACCEPTED));

    await service(fetch, null).verify(undefined, 'register', '203.0.113.7');

    expect(calls).toEqual([]);
  });

  it('refuses a missing token without calling out', async () => {
    const { fetch, calls } = fakeFetch(reply(ACCEPTED));

    expect(
      await codeOf(service(fetch).verify(undefined, 'register', '203.0.113.7'))
    ).toBe('400 challenge_failed');
    expect(calls).toEqual([]);
  });

  it('sends the secret, the token and the caller address', async () => {
    const { fetch, calls } = fakeFetch(reply(ACCEPTED));

    await service(fetch).verify('token-1', 'register', '203.0.113.7');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(SITEVERIFY_URL);
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      secret: 'turnstile-secret',
      response: 'token-1',
      remoteip: '203.0.113.7'
    });
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [
      'Cloudflare refuses it',
      { ...ACCEPTED, success: false, 'error-codes': ['invalid-input-response'] }
    ],
    [
      'it was already redeemed',
      { ...ACCEPTED, success: false, 'error-codes': ['timeout-or-duplicate'] }
    ],
    [
      'it was solved on another host',
      { ...ACCEPTED, hostname: 'logigator.test' }
    ],
    ['it was solved for another form', { ...ACCEPTED, action: 'report' }],
    ['it names no action', { ...ACCEPTED, action: '' }],
    ['success is not literally true', { ...ACCEPTED, success: 'true' }]
  ])('refuses a token when %s', async (_, body) => {
    const { fetch } = fakeFetch(reply(body));

    expect(
      await codeOf(service(fetch).verify('token-1', 'register', '203.0.113.7'))
    ).toBe('400 challenge_failed');
  });

  it.each([
    [
      'the secret is wrong',
      reply({ success: false, 'error-codes': ['invalid-input-secret'] })
    ],
    [
      'Cloudflare fails internally',
      reply({ success: false, 'error-codes': ['internal-error'] })
    ],
    ['the answer is not 2xx', reply({}, 502)],
    ['the answer is not JSON', () => new Response('<html>', { status: 200 })],
    ['the answer is not an object', reply(null)],
    ['the network fails', () => Promise.reject(new TypeError('fetch failed'))]
  ])('answers an outage, not a refusal, when %s', async (_, answer) => {
    const { fetch } = fakeFetch(answer);

    expect(
      await codeOf(service(fetch).verify('token-1', 'register', '203.0.113.7'))
    ).toBe('503 service_unavailable');
  });
});
