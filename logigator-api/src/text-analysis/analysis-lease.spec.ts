import { describe, expect, it } from 'vitest';
import {
  leaseRunningOutAt,
  startOfNextUtcDay,
  ANALYSIS_LEASE_MINUTES,
  utcDay
} from './analysis-lease';

const DAY_MS = 24 * 60 * 60_000;

describe('the next UTC day', () => {
  const instants = [
    Date.UTC(2026, 9, 21, 0, 0, 0, 0),
    Date.UTC(2026, 9, 21, 13, 37, 0, 0),
    Date.UTC(2026, 9, 21, 23, 59, 59, 999),
    Date.UTC(2026, 11, 31, 23, 0, 0, 0),
    Date.UTC(2028, 1, 28, 12, 0, 0, 0)
  ];

  it('starts at a UTC midnight within one day after any instant', () => {
    for (const now of instants) {
      const next = startOfNextUtcDay(now);
      expect(next).toBeGreaterThan(now);
      expect(next - now).toBeLessThanOrEqual(DAY_MS);
      expect(new Date(next).toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
  });

  it('is the day after the one the counter is keyed by', () => {
    for (const now of instants) {
      const next = startOfNextUtcDay(now);
      expect(utcDay(next)).not.toBe(utcDay(now));
      expect(utcDay(next - 1)).toBe(utcDay(now));
    }
  });
});

describe('leaseRunningOutAt', () => {
  it('writes a claim whose lease ends exactly at the instant', () => {
    const instant = Date.UTC(2026, 9, 22);
    const claimedAt = leaseRunningOutAt(instant).getTime();
    expect(claimedAt + ANALYSIS_LEASE_MINUTES * 60_000).toBe(instant);
  });
});
