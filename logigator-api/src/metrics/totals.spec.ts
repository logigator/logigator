import { Logger } from '@nestjs/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env';
import type { Database } from '../database/database.module';
import { Metrics } from './metrics';
import { readTotals, type Totals } from './totals-queries';
import { DatabaseTotals, TOTALS_MAX_AGE_MS, writeTotals } from './totals';

vi.mock('./totals-queries', () => ({ readTotals: vi.fn() }));

function totals(overrides: Partial<Totals> = {}): Totals {
  return {
    users: { verified: 0, unverified: 0 },
    documents: [],
    stars: 0,
    openReports: { human: 0, machine: 0 },
    textsAwaitingCheck: 0,
    textsParked: 0,
    storageBytes: { documents: 0, previews: 0 },
    ...overrides
  };
}

/** A database whose transaction hands the callback straight through. */
const db = {
  transaction: (read: (tx: unknown) => Promise<unknown>) => read({})
} as unknown as Database;

async function stars(metrics: Metrics): Promise<number[]> {
  return (await metrics.stars.get()).values.map(({ value }) => value);
}

describe('writeTotals', () => {
  it('reports every document combination, zeros included', async () => {
    const metrics = new Metrics();
    writeTotals(
      metrics,
      totals({
        documents: [
          { kind: 'component', visibility: 'public', hidden: true, count: 4 }
        ]
      })
    );

    const values = (await metrics.documents.get()).values;
    expect(values).toHaveLength(12);
    expect(values.filter(({ value }) => value !== 0)).toEqual([
      {
        labels: { kind: 'component', visibility: 'public', hidden: 'true' },
        value: 4
      }
    ]);
  });
});

describe('DatabaseTotals', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(readTotals).mockReset();
  });

  it('reads the database at most once per window', async () => {
    vi.useFakeTimers();
    const metrics = new Metrics();
    const reader = new DatabaseTotals(db, {} as Env, metrics);
    vi.mocked(readTotals)
      .mockResolvedValueOnce(totals({ stars: 1 }))
      .mockResolvedValueOnce(totals({ stars: 2 }));

    await reader.refresh();
    vi.advanceTimersByTime(TOTALS_MAX_AGE_MS - 1);
    await reader.refresh();
    expect(await stars(metrics)).toEqual([1]);

    vi.advanceTimersByTime(1);
    await reader.refresh();
    expect(await stars(metrics)).toEqual([2]);
    expect(readTotals).toHaveBeenCalledTimes(2);
  });

  it('keeps the last totals and their time when a reading fails', async () => {
    vi.useFakeTimers();
    const metrics = new Metrics();
    const reader = new DatabaseTotals(db, {} as Env, metrics);
    vi.mocked(readTotals)
      .mockResolvedValueOnce(totals({ stars: 3 }))
      .mockRejectedValueOnce(new Error('connection refused'));

    await reader.refresh();
    const readAt = (await metrics.totalsReadAt.get()).values[0]?.value;
    vi.advanceTimersByTime(TOTALS_MAX_AGE_MS);
    await expect(reader.refresh()).resolves.toBeUndefined();

    expect(await stars(metrics)).toEqual([3]);
    expect((await metrics.totalsReadAt.get()).values[0]?.value).toBe(readAt);
  });
});
