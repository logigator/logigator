import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { Metrics } from '../metrics/metrics';
import { UnverifiedAccountSweepService } from './unverified-account-sweep.service';

const NOW = new Date('2026-11-06T04:00:00Z');

describe('UnverifiedAccountSweepService.scheduled', () => {
  let metrics: Metrics;
  let service: UnverifiedAccountSweepService;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    vi.spyOn(Logger.prototype, 'log').mockReturnValue(undefined);
    vi.spyOn(Logger.prototype, 'error').mockReturnValue(undefined);
    metrics = new Metrics();
    service = new UnverifiedAccountSweepService({} as never, metrics);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('counts the accounts removed and notes the time of the run', async () => {
    vi.spyOn(service, 'sweep').mockResolvedValueOnce(3);

    await service.scheduled();

    expect((await metrics.sweepRemoved.get()).values).toEqual([
      { labels: { sweep: 'unverified_accounts' }, value: 3 }
    ]);
    expect((await metrics.sweepLastSuccess.get()).values).toEqual([
      { labels: { sweep: 'unverified_accounts' }, value: NOW.getTime() / 1000 }
    ]);
  });

  it('notes no success time for a run that failed', async () => {
    vi.spyOn(service, 'sweep').mockRejectedValueOnce(new Error('db down'));

    await service.scheduled();

    expect((await metrics.sweepLastSuccess.get()).values).toEqual([]);
  });
});
