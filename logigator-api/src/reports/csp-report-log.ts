import type { FastifyBaseLogger } from 'fastify';
import type { RedisService } from '../redis/redis.service';
import { cspViolationsFrom } from './csp-report';

export type LogLine = Pick<FastifyBaseLogger, 'warn'>;

/** The span every limit below is counted over. */
export const CSP_WINDOW_SECONDS = 10 * 60;

/** Violations one process logs per window, from everyone together. */
export const CSP_LOG_CAP = 200;

/**
 * Distinct violations one address may have logged per window. Repeats are
 * dropped before they count, so a classroom on one NAT reporting the same
 * pages spends little of it.
 */
export const CSP_ADDRESS_LIMIT = 100;

interface Dropped {
  /** Bodies that held no readable violation. */
  unreadable: number;
  duplicate: number;
  addressLimit: number;
  logCap: number;
}

/**
 * Where CSP violation reports end up: one `csp violation` line each, through
 * the request's logger, within three limits. A violation logged this window is
 * not logged again; one address may log {@link CSP_ADDRESS_LIMIT} of them,
 * counted in Redis so every process shares the budget; and the process logs
 * {@link CSP_LOG_CAP} in all. What the limits hold back is only counted, and
 * the next window opens with one `csp reports dropped` line saying how much.
 *
 * Redis is asked only about a violation that would otherwise be logged, so a
 * flood of repeats, garbage or reports past the cap costs no round trip.
 */
export class CspReportLog {
  private windowStart: number;
  private seen = new Set<string>();
  private dropped: Dropped = emptyDropped();

  constructor(
    private readonly counter: Pick<RedisService, 'countInWindows'>,
    private readonly summaryLog: LogLine,
    private readonly now: () => number = Date.now
  ) {
    this.windowStart = now();
  }

  /** Never rejects: a report is answered the same whatever became of it. */
  async receive(
    body: unknown,
    address: string,
    userAgent: string | undefined,
    log: LogLine
  ): Promise<void> {
    this.rollOver();
    const violations = cspViolationsFrom(body, userAgent);
    if (violations.length === 0) {
      this.dropped.unreadable++;
      return;
    }

    const fresh = violations
      .map((violation) => ({ violation, key: JSON.stringify(violation) }))
      .filter(({ key }) => this.admits(key));
    if (fresh.length === 0) return;

    // One hit per violation, so the counts say which of them still fit. A
    // Redis that cannot answer lets them through: the cap still holds.
    const counts = await this.counter
      .countInWindows(
        fresh.map(() => `rate:csp-report:${address}`),
        CSP_WINDOW_SECONDS
      )
      .catch(() => fresh.map(() => 0));

    this.rollOver();
    fresh.forEach(({ violation, key }, index) => {
      if ((counts[index] ?? 0) > CSP_ADDRESS_LIMIT) {
        this.dropped.addressLimit++;
      } else if (this.admits(key)) {
        this.seen.add(key);
        log.warn({ csp: violation }, 'csp violation');
      }
    });
  }

  /** Whether a violation may still be logged, counting it if not. */
  private admits(key: string): boolean {
    if (this.seen.has(key)) {
      this.dropped.duplicate++;
      return false;
    }
    if (this.seen.size >= CSP_LOG_CAP) {
      this.dropped.logCap++;
      return false;
    }
    return true;
  }

  private rollOver(): void {
    const now = this.now();
    if (now - this.windowStart < CSP_WINDOW_SECONDS * 1000) return;

    const dropped = this.dropped;
    if (Object.values(dropped).some((count) => count > 0)) {
      this.summaryLog.warn(
        {
          csp: {
            since: new Date(this.windowStart).toISOString(),
            logged: this.seen.size,
            dropped
          }
        },
        'csp reports dropped'
      );
    }
    this.windowStart = now;
    this.seen = new Set();
    this.dropped = emptyDropped();
  }
}

function emptyDropped(): Dropped {
  return { unreadable: 0, duplicate: 0, addressLimit: 0, logCap: 0 };
}
