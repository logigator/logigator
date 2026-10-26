import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisService } from '../src/redis/redis.service';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

const CREDENTIALS = { email: 'ada@example.com', password: 'lovelace1' };

const REPORT_URI_BODY = JSON.stringify({
  'csp-report': {
    'document-uri':
      'https://logigator.test/en/verify-email/0Zk3nQxV9pL2mR8sT4wY6',
    'effective-directive': 'script-src-elem',
    'blocked-uri': 'inline',
    disposition: 'report'
  }
});

const REPORTING_API_BODY = JSON.stringify([
  {
    type: 'csp-violation',
    url: 'https://logigator.test/en/',
    body: {
      documentURL: 'https://logigator.test/en/',
      effectiveDirective: 'img-src',
      blockedURL: 'data',
      disposition: 'report'
    }
  }
]);

/**
 * Browsers post here with whatever cookies the origin holds, signed in or
 * not, so the route is driven with a live session whose every response would
 * otherwise slide it.
 */
describe('POST /api/csp-report', () => {
  let api: E2eApp;
  const jar = new CookieJar();

  function report(contentType: string, payload: string, headers = {}) {
    return api.inject({
      method: 'POST',
      url: '/api/csp-report',
      headers: { 'content-type': contentType, ...headers },
      payload
    });
  }

  async function redisKeys(): Promise<string[]> {
    const redis = api.app.get(RedisService);
    return redis.client.keys(redis.key('*'));
  }

  beforeAll(async () => {
    api = await startE2eApp({ SESSION_TOUCH_INTERVAL_MINUTES: '0' });
    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Ada', ...CREDENTIALS }
    });
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });
    jar.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: CREDENTIALS
      })
    );
  });

  afterAll(async () => {
    await api.close();
  });

  it.each([
    ['report-uri', 'application/csp-report', REPORT_URI_BODY],
    ['the Reporting API', 'application/reports+json', REPORTING_API_BODY],
    ['a charset', 'application/csp-report; charset=utf-8', REPORT_URI_BODY]
  ])('takes a report from %s with an empty 204', async (_, type, body) => {
    const response = await report(type, body);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it.each([
    ['malformed JSON', '{"csp-report":'],
    ['JSON of another shape', '{"hello":"world"}'],
    ['an empty body', '']
  ])('answers %s the same way', async (_, body) => {
    const response = await report('application/csp-report', body);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('refuses a body past its limit before reading it', async () => {
    const response = await report(
      'application/reports+json',
      `[${'"x",'.repeat(5000)}"x"]`
    );

    expect(response.statusCode).toBe(413);
    expect(response.body).toBe('');
  });

  it.each(['application/json', 'text/plain', 'multipart/form-data'])(
    'refuses %s',
    async (type) => {
      const response = await report(type, REPORT_URI_BODY);

      expect(response.statusCode).toBe(415);
      expect(response.body).toBe('');
    }
  );

  it('leaves the session alone', async () => {
    const response = await report(
      'application/csp-report',
      REPORT_URI_BODY,
      jar.headers()
    );
    // Another route answering the same cookie slides the session.
    const control = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(control.headers['set-cookie']).toBeDefined();
  });

  it('stores nothing but the per-address counter', async () => {
    const redis = api.app.get(RedisService);
    const before = await redisKeys();

    await report(
      'application/reports+json',
      REPORTING_API_BODY.replace('img-src', 'font-src'),
      jar.headers()
    );
    await report('application/csp-report', 'garbage', jar.headers());

    expect(new Set(await redisKeys())).toEqual(
      new Set([...before, redis.key('rate:csp-report:127.0.0.1')])
    );
  });

  it('answers no CORS headers', async () => {
    const response = await report('application/csp-report', REPORT_URI_BODY, {
      origin: 'https://elsewhere.example'
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
