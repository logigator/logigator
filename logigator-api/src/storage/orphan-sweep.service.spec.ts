import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { Env } from '../config/env';
import { Metrics } from '../metrics/metrics';
import { OrphanSweepService, type SweepReport } from './orphan-sweep.service';

const NOW = new Date('2026-11-06T04:00:00Z');

function report(removed: number): SweepReport {
  return { scanned: removed, removed, spared: 0 };
}

describe('OrphanSweepService.scheduled', () => {
  let metrics: Metrics;
  let service: OrphanSweepService;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    vi.spyOn(Logger.prototype, 'log').mockReturnValue(undefined);
    vi.spyOn(Logger.prototype, 'error').mockReturnValue(undefined);
    metrics = new Metrics();
    service = new OrphanSweepService(
      { STORAGE_DIR: '/nowhere', STORAGE_SWEEP_GRACE_MINUTES: 60 } as Env,
      {} as never,
      {} as never,
      metrics
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function lastSuccess() {
    return (await metrics.sweepLastSuccess.get()).values;
  }

  it('counts what both areas removed and notes the time of a clean run', async () => {
    vi.spyOn(service, 'sweep')
      .mockResolvedValueOnce(report(2))
      .mockResolvedValueOnce(report(3));

    await service.scheduled();

    expect((await metrics.sweepRemoved.get()).values).toEqual([
      { labels: { sweep: 'orphaned_files' }, value: 5 }
    ]);
    expect(await lastSuccess()).toEqual([
      { labels: { sweep: 'orphaned_files' }, value: NOW.getTime() / 1000 }
    ]);
  });

  it('keeps what one area removed but no success time when the other fails', async () => {
    vi.spyOn(service, 'sweep')
      .mockRejectedValueOnce(new Error('volume gone'))
      .mockResolvedValueOnce(report(4));

    await service.scheduled();

    expect((await metrics.sweepRemoved.get()).values).toEqual([
      { labels: { sweep: 'orphaned_files' }, value: 4 }
    ]);
    expect(await lastSuccess()).toEqual([]);
  });
});
