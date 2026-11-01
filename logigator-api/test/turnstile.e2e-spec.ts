import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectSummary } from '@logigator/contract';
import { eq } from 'drizzle-orm';
import { documentReports, users } from '../src/database/schema';
import { circuitDocument, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

const PASSWORD = 'lovelace1';

const REPORT = {
  reason: 'spam',
  explanation: 'Advertises something unrelated.'
} as const;

/**
 * Cloudflare's siteverify as the API sees it: a token `solved:<action>`
 * passes for that action on the site's host, anything else is refused.
 */
class FakeSiteverify {
  down = false;

  readonly fetch = (async (_input: unknown, init?: RequestInit) => {
    if (this.down) throw new TypeError('fetch failed');
    const { response } = JSON.parse(String(init?.body)) as {
      response: string;
    };
    const [solved, action] = response.split(':');
    return Response.json(
      solved === 'solved'
        ? { success: true, hostname: 'logigator.test', action }
        : { success: false, 'error-codes': ['invalid-input-response'] }
    );
  }) as typeof globalThis.fetch;
}

describe('the challenge on routes anybody can make mail', () => {
  let api: E2eApp;
  const siteverify = new FakeSiteverify();
  /** A public project to report. */
  let link: string;

  const post = (url: string, payload: Record<string, unknown>) =>
    api.inject({ method: 'POST', url, payload });

  const accountsFor = async (email: string) =>
    (await api.db.select().from(users).where(eq(users.email, email))).length;

  const reportCount = async () =>
    (await api.db.select().from(documentReports)).length;

  beforeAll(async () => {
    api = await startE2eApp(
      {
        TURNSTILE_SECRET_KEY: 'e2e-turnstile-secret',
        TURNSTILE_SITE_KEY: 'e2e-turnstile-site',
        REPORT_MAIL_TO: 'ops@logigator.test'
      },
      { siteverify: siteverify.fetch }
    );

    const email = 'ada@example.com';
    await post('/api/auth/register', {
      username: 'Ada',
      email,
      password: PASSWORD,
      turnstileToken: 'solved:register'
    });
    await post('/api/auth/verify-email', { token: api.mail.lastToken() });
    const ada = new CookieJar();
    ada.store(await post('/api/auth/login', { email, password: PASSWORD }));
    const created = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: ada.headers(),
      payload: {
        name: 'Reported',
        visibility: 'public',
        document: circuitDocument('Reported', HALF_ADDER_BODY)
      }
    });
    expect(created.statusCode).toBe(201);
    link = created.json<ProjectSummary>().link;
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(() => {
    siteverify.down = false;
    api.mail.clear();
  });

  describe('registering', () => {
    const register = (email: string, turnstileToken?: string) =>
      post('/api/auth/register', {
        username: 'Grace',
        email,
        password: PASSWORD,
        ...(turnstileToken ? { turnstileToken } : {})
      });

    it('creates and mails nothing without a token', async () => {
      const response = await register('none@example.com');

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('challenge_failed');
      expect(await accountsFor('none@example.com')).toBe(0);
      expect(api.mail.sent).toEqual([]);
    });

    it('refuses a token Cloudflare refuses', async () => {
      const response = await register('forged@example.com', 'forged');

      expect(response.json().code).toBe('challenge_failed');
      expect(await accountsFor('forged@example.com')).toBe(0);
      expect(api.mail.sent).toEqual([]);
    });

    it('refuses a token solved for another form', async () => {
      const response = await register('other@example.com', 'solved:report');

      expect(response.json().code).toBe('challenge_failed');
      expect(await accountsFor('other@example.com')).toBe(0);
    });

    it('registers with a token solved for it', async () => {
      const response = await register('grace@example.com', 'solved:register');

      expect(response.statusCode).toBe(201);
      expect(api.mail.last().to).toBe('grace@example.com');
    });

    it('answers an outage and creates nothing while Cloudflare is unreachable', async () => {
      siteverify.down = true;

      const response = await register('outage@example.com', 'solved:register');

      expect(response.statusCode).toBe(503);
      expect(response.json().code).toBe('service_unavailable');
      expect(await accountsFor('outage@example.com')).toBe(0);
    });
  });

  describe('asking for a password reset', () => {
    it('mails nothing without a token', async () => {
      const response = await post('/api/auth/password-reset', {
        email: 'ada@example.com'
      });

      expect(response.json().code).toBe('challenge_failed');
      expect(api.mail.sent).toEqual([]);
    });

    it('mails the link with a token solved for it', async () => {
      const response = await post('/api/auth/password-reset', {
        email: 'ada@example.com',
        turnstileToken: 'solved:password-reset'
      });

      expect(response.statusCode).toBe(204);
      expect(api.mail.last().to).toBe('ada@example.com');
    });

    it('spends no mailbox budget on a refused challenge', async () => {
      // Five resets per mailbox and hour: a script without tokens must not
      // be able to use them up.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await api.inject({
          method: 'POST',
          url: '/api/auth/password-reset',
          remoteAddress: `203.0.113.${attempt + 1}`,
          payload: { email: 'ada@example.com' }
        });
      }

      const response = await post('/api/auth/password-reset', {
        email: 'ada@example.com',
        turnstileToken: 'solved:password-reset'
      });
      expect(response.statusCode).toBe(204);
      expect(api.mail.last().to).toBe('ada@example.com');
    });
  });

  describe('reporting a document', () => {
    it('stores and mails nothing without a token', async () => {
      const before = await reportCount();

      const response = await post(
        `/api/community/projects/${link}/report`,
        REPORT
      );

      expect(response.json().code).toBe('challenge_failed');
      expect(await reportCount()).toBe(before);
      expect(api.mail.sent).toEqual([]);
    });

    it('takes the report with a token solved for it', async () => {
      const before = await reportCount();

      const response = await post(`/api/community/projects/${link}/report`, {
        ...REPORT,
        turnstileToken: 'solved:report'
      });

      expect(response.statusCode).toBe(201);
      expect(await reportCount()).toBe(before + 1);
      expect(api.mail.last().to).toBe('ops@logigator.test');
    });
  });
});
