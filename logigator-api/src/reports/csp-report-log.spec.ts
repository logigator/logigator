import { beforeEach, describe, expect, it } from 'vitest';
import {
  CSP_ADDRESS_LIMIT,
  CSP_LOG_CAP,
  CSP_WINDOW_SECONDS,
  CspReportLog,
  type LogLine
} from './csp-report-log';

/** Redis's fixed windows, per key, on the test's clock. */
class FakeCounter {
  readonly counts = new Map<string, number>();
  calls = 0;
  failing = false;

  countInWindows(keys: string[]): Promise<number[]> {
    this.calls++;
    if (this.failing) return Promise.reject(new Error('Redis is down'));
    return Promise.resolve(
      keys.map((key) => {
        const count = (this.counts.get(key) ?? 0) + 1;
        this.counts.set(key, count);
        return count;
      })
    );
  }
}

class RecordingLog implements LogLine {
  readonly lines: { msg: string; csp: unknown }[] = [];

  warn = ((object: { csp: unknown }, msg: string) => {
    this.lines.push({ msg, csp: object.csp });
  }) as LogLine['warn'];

  messages(msg: string) {
    return this.lines.filter((line) => line.msg === msg);
  }
}

function report(blocked: string) {
  return {
    'csp-report': {
      'effective-directive': 'img-src',
      'blocked-uri': `https://images.example/${blocked}`,
      'document-uri': 'https://logigator.com/en/'
    }
  };
}

describe('CspReportLog', () => {
  let now: number;
  let counter: FakeCounter;
  let requestLog: RecordingLog;
  let summaryLog: RecordingLog;
  let log: CspReportLog;

  function receive(body: unknown, address = '203.0.113.7') {
    return log.receive(body, address, undefined, requestLog);
  }

  function nextWindow() {
    now += CSP_WINDOW_SECONDS * 1000;
  }

  beforeEach(() => {
    now = 0;
    counter = new FakeCounter();
    requestLog = new RecordingLog();
    summaryLog = new RecordingLog();
    log = new CspReportLog(counter, summaryLog, () => now);
  });

  it('logs a violation once per window', async () => {
    await receive(report('a'));
    await receive(report('a'));
    await receive(report('a'), '198.51.100.1');

    expect(requestLog.messages('csp violation')).toHaveLength(1);
    // The repeats were dropped before they reached Redis.
    expect(counter.calls).toBe(1);

    nextWindow();
    await receive(report('a'));
    expect(requestLog.messages('csp violation')).toHaveLength(2);
  });

  it('logs no more than the cap per window, then says how much it dropped', async () => {
    for (let i = 0; i < CSP_LOG_CAP + 25; i++) {
      await receive(report(`${i}`), `198.51.100.${i % 200}`);
    }
    await receive('garbage');

    expect(requestLog.messages('csp violation')).toHaveLength(CSP_LOG_CAP);
    expect(summaryLog.lines).toHaveLength(0);
    // Past the cap, a report costs no round trip.
    expect(counter.calls).toBe(CSP_LOG_CAP);

    nextWindow();
    await receive(report('fresh'));

    expect(summaryLog.messages('csp reports dropped')).toEqual([
      {
        msg: 'csp reports dropped',
        csp: {
          since: new Date(0).toISOString(),
          logged: CSP_LOG_CAP,
          dropped: { unreadable: 1, duplicate: 0, addressLimit: 0, logCap: 25 }
        }
      }
    ]);
    expect(requestLog.messages('csp violation')).toHaveLength(CSP_LOG_CAP + 1);
  });

  it('writes no summary for a window that dropped nothing', async () => {
    await receive(report('a'));
    nextWindow();
    await receive(report('b'));

    expect(summaryLog.lines).toHaveLength(0);
  });

  it('holds one address to its own budget, leaving room for others', async () => {
    const batch = (from: number) =>
      Array.from({ length: 20 }, (_, i) => ({
        type: 'csp-violation',
        body: { effectiveDirective: 'img-src', lineNumber: from + i }
      }));
    for (let i = 0; i < CSP_ADDRESS_LIMIT + 40; i += 20) {
      await receive(batch(i));
    }
    await receive(report('elsewhere'), '198.51.100.1');

    const logged = requestLog.messages('csp violation');
    expect(logged).toHaveLength(CSP_ADDRESS_LIMIT + 1);
    expect(logged.at(-1)?.csp).toMatchObject({
      blocked: 'https://images.example/elsewhere'
    });

    nextWindow();
    await receive(report('z'));
    expect(summaryLog.lines[0]?.csp).toMatchObject({
      dropped: { addressLimit: 40 }
    });
  });

  it('still logs within the cap when Redis cannot count', async () => {
    counter.failing = true;

    await receive(report('a'));
    await receive(report('a'));

    expect(requestLog.messages('csp violation')).toHaveLength(1);
  });

  it('logs one of two identical violations in one request', async () => {
    await receive([
      { type: 'csp-violation', body: { effectiveDirective: 'img-src' } },
      { type: 'csp-violation', body: { effectiveDirective: 'img-src' } }
    ]);

    expect(requestLog.messages('csp violation')).toHaveLength(1);
  });
});
