import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { InjectPayload } from 'light-my-request';
import { startE2eApp, type E2eApp } from './harness';

/** The report shape the editor sends today, which must keep working verbatim. */
const EDITOR_REPORT = {
  source: 'editor-v2',
  correlationId: 'c0ffee',
  message: 'Cannot read properties of undefined',
  file: 'main.js',
  line: 42,
  col: 7,
  stack: 'Error\n  at x (main.js:42:7)',
  userAgent: 'Mozilla/5.0',
  userMessage: 'it broke when I pressed undo',
  logs: 'a\nb\nc',
  projectDump: '{"version":1,"name":"Board","components":[],"wires":""}',
  client: {
    browser: 'Chrome 140',
    os: 'Linux',
    renderingContext: 'webgl2',
    windowWidth: 1920,
    windowHeight: 1080,
    devicePixelRatio: 2,
    locale: 'en',
    workMode: 'select',
    simulationRunning: false,
    touch: false
  }
};

describe('error reports', () => {
  let api: E2eApp;

  const post = (payload: InjectPayload, headers: Record<string, string> = {}) =>
    api.inject({
      method: 'POST',
      url: '/api/report-error',
      headers,
      payload
    });

  beforeAll(async () => {
    api = await startE2eApp({ REPORT_MAIL_TO: 'ops@logigator.test' });
  });

  afterAll(async () => {
    await api.close();
  });

  it('accepts the shape the editor already sends, unauthenticated', async () => {
    // The path and the fields are fixed from outside: the editor posts this
    // today, so the cutover has to be a no-op for it.
    const response = await post(EDITOR_REPORT);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ received: true });
  });

  it('accepts a report from the old editor too', async () => {
    // The legacy positional payload, which only the old editor sends. It stays
    // accepted (as an opaque object) so a report arriving mid-cutover is not
    // rejected for being what it has always been.
    const response = await post({
      project: { project: { name: 'Old', elements: [] }, components: [] }
    });
    expect(response.statusCode).toBe(201);
  });

  it('accepts an empty report rather than arguing about it', async () => {
    // Every field is optional: a client that crashed before it could describe
    // itself is exactly the case worth hearing about.
    expect((await post({})).statusCode).toBe(201);
  });

  it('mails the report with the circuit attached', async () => {
    api.mail.clear();
    await post(EDITOR_REPORT);

    expect(api.mail.sent).toHaveLength(1);
    const mail = api.mail.sent[0];
    expect(mail.to).toBe('ops@logigator.test');
    expect(mail.subject).toContain('Cannot read properties of undefined');
    expect(mail.text).toContain('c0ffee');
    expect(mail.text).toContain('at x (main.js:42:7)');
    // The circuit is the most useful part of a report and the part that would
    // make the body unreadable inline.
    expect(mail.attachments[0]?.filename).toBe('circuit.json');
    expect(mail.attachments[0]?.content).toContain('"name":"Board"');
  });

  it('caps a field rather than storing whatever arrives', async () => {
    const response = await post({ message: 'x'.repeat(5000) });

    // An unauthenticated write of attacker-chosen text; the bound is the only
    // thing between it and a log nobody can read.
    expect(response.statusCode).toBe(422);
    expect(Object.keys(response.json().details)).toEqual(['message']);
  });

  it('rate-limits by address', async () => {
    const fresh = await startE2eApp();
    try {
      const results: number[] = [];
      for (let attempt = 0; attempt < 12; attempt += 1) {
        results.push(
          (
            await fresh.inject({
              method: 'POST',
              url: '/api/report-error',
              payload: { message: `attempt ${attempt}` }
            })
          ).statusCode
        );
      }

      expect(results.filter((status) => status === 201)).toHaveLength(10);
      expect(results.at(-1)).toBe(429);
    } finally {
      await fresh.close();
    }
  });

  it('still answers when there is nowhere to mail it', async () => {
    const fresh = await startE2eApp();
    try {
      // Logging is the sink that always works; naming a mailbox is the
      // deliberate act of deciding to read them.
      const response = await fresh.inject({
        method: 'POST',
        url: '/api/report-error',
        payload: EDITOR_REPORT
      });
      expect(response.statusCode).toBe(201);
      expect(fresh.mail.sent).toHaveLength(0);
    } finally {
      await fresh.close();
    }
  });
});
