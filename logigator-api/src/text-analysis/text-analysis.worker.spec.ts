import { Logger } from '@nestjs/common';
import type { SchedulerRegistry } from '@nestjs/schedule';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env';
import type { Database } from '../database/database.module';
import { MAX_ANALYSIS_ATTEMPTS } from '../database/schema';
import { Metrics } from '../metrics/metrics';
import type { MachineModerationService } from '../moderation/machine-moderation.service';
import type { RedisService } from '../redis/redis.service';
import type { DocumentTranslation } from '../translation/document-translation';
import {
  claimPending,
  type ClaimedDocument,
  recordFailure,
  renewForCall,
  settleAnalysis
} from './analysis-queries';
import type { AnalysisOutcome, TextAnalyzer } from './text-analyzer';
import { TextAnalysisWorker } from './text-analysis.worker';

vi.mock('./analysis-queries', () => ({
  claimPending: vi.fn(),
  renewForCall: vi.fn(),
  releaseClaim: vi.fn(),
  holdClaimUntil: vi.fn(),
  recordFailure: vi.fn(),
  settleAnalysis: vi.fn()
}));
vi.mock('../documents/document-text-queries', () => ({
  humanVersionsOf: vi.fn(async () => new Map())
}));

const POLL_SECONDS = 30;

function claim(id: string, userId = 'owner-1'): ClaimedDocument {
  return {
    id,
    userId,
    name: 'Adder',
    description: '',
    textDigest: `digest-${id}`,
    textLanguageHint: null,
    claimedAt: '2026-11-06T12:00:00Z'
  };
}

const accounted = { calls: [], verdict: null, verdictCall: null };

const success: AnalysisOutcome = {
  kind: 'success',
  translation: {} as DocumentTranslation,
  model: 'vendor/model',
  ...accounted,
  verdict: { category: 'none', certain: false, note: '' }
};
const documentFailure: AnalysisOutcome = {
  kind: 'document',
  reason: 'the reply hit the token limit',
  ...accounted
};
const transient: AnalysisOutcome = {
  kind: 'transient',
  reason: 'OpenRouter answered 502',
  retryAfterSeconds: null,
  ...accounted
};
const budget: AnalysisOutcome = {
  kind: 'system',
  pause: 'budget',
  reason: 'OpenRouter answered 402',
  ...accounted
};

function harness(dailyLimit = 100) {
  let now = Date.UTC(2026, 10, 6, 12);
  const outcomes: AnalysisOutcome[] = [];
  const analyzer: TextAnalyzer = {
    analyze: vi.fn(async () => {
      const next = outcomes.shift();
      if (!next) throw new Error('unexpected call');
      return next;
    }),
    readBudget: vi.fn(async () => ({
      kind: 'available' as const,
      remainingUsd: null
    }))
  };
  const counts = new Map<string, number>();
  const redis = {
    countInWindow: async (key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key);
    },
    key: (key: string) => key,
    client: { incrBy: async () => 0 }
  } as unknown as RedisService;
  const moderation = {
    apply: async () => 'ignored',
    reportUnjudged: async () => true
  } as unknown as MachineModerationService;
  const metrics = new Metrics();

  const worker = new TextAnalysisWorker(
    {
      TEXT_ANALYSIS_POLL_SECONDS: POLL_SECONDS,
      TEXT_ANALYSIS_DEBOUNCE_SECONDS: 0,
      TEXT_ANALYSIS_BATCH: 5,
      TEXT_ANALYSIS_DAILY_LIMIT_PER_USER: dailyLimit
    } as Env,
    {} as Database,
    analyzer,
    { now: () => now },
    redis,
    {} as SchedulerRegistry,
    moderation,
    metrics
  );

  return {
    metrics,
    analyzer,
    /** One tick over these claims, each answered by its outcome in turn. */
    tick(claims: ClaimedDocument[], answers: AnalysisOutcome[]) {
      if (claims.length > 0) {
        vi.mocked(claimPending).mockResolvedValueOnce(claims);
      }
      outcomes.push(...answers);
      return worker.tick();
    },
    advance(ms: number) {
      now += ms;
    }
  };
}

async function series(metric: {
  get(): Promise<{ values: { labels: object; value: number }[] }>;
}) {
  return (await metric.get()).values.map(({ labels, value }) => ({
    ...labels,
    value
  }));
}

describe('TextAnalysisWorker metrics', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    vi.mocked(claimPending).mockReset().mockResolvedValue([]);
    vi.mocked(renewForCall)
      .mockReset()
      .mockImplementation(async (_db, _table, claimed) => claimed);
    vi.mocked(settleAnalysis).mockReset().mockResolvedValue(true);
    vi.mocked(recordFailure).mockReset();
  });

  it('counts a text analyzed only once its result is written', async () => {
    const { metrics, tick } = harness();
    // The second result is for a text edited during the call.
    vi.mocked(settleAnalysis)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await tick([claim('a'), claim('b')], [success, success]);

    expect(await series(metrics.textAnalysisTexts)).toEqual([
      { outcome: 'analyzed', value: 1 }
    ]);
  });

  it('counts a failed attempt as failed and the one that parks the text as parked', async () => {
    const { metrics, tick } = harness();
    vi.mocked(recordFailure)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(MAX_ANALYSIS_ATTEMPTS);

    await tick([claim('a'), claim('b')], [documentFailure, documentFailure]);

    expect(await series(metrics.textAnalysisTexts)).toEqual([
      { outcome: 'failed', value: 1 },
      { outcome: 'parked', value: 1 }
    ]);
  });

  it('counts nothing for a transient failure, which leaves the text as it was', async () => {
    const { metrics, tick } = harness();
    await tick([claim('a')], [transient]);
    expect(await series(metrics.textAnalysisTexts)).toEqual([]);
  });

  it('marks exactly the active pause’s kind, and none once a call works again', async () => {
    const { metrics, tick, advance } = harness();
    const paused = async () =>
      Object.fromEntries(
        (await metrics.textAnalysisPaused.get()).values.map(
          ({ labels, value }) => [labels.kind, value]
        )
      );
    const running = { backoff: 0, budget: 0, configuration: 0 };

    expect(await paused()).toEqual(running);

    await tick([claim('a')], [transient]);
    expect(await paused()).toEqual({ ...running, backoff: 1 });

    advance(2 * POLL_SECONDS * 1000);
    await tick([claim('b')], [budget]);
    expect(await paused()).toEqual({ ...running, budget: 1 });

    // Still within the pause: nothing is claimed and the gauge holds.
    await tick([], []);
    expect(await paused()).toEqual({ ...running, budget: 1 });

    advance(30 * 60_000);
    await tick([claim('c')], [success]);
    expect(await paused()).toEqual(running);
  });

  it('counts every document held back for an owner over the daily limit', async () => {
    const { metrics, analyzer, tick } = harness(1);

    await tick(
      [claim('a'), claim('b'), claim('c'), claim('d', 'owner-2')],
      [success, success]
    );

    expect(analyzer.analyze).toHaveBeenCalledTimes(2);
    expect(await series(metrics.textAnalysisOwnerLimitReached)).toEqual([
      { value: 2 }
    ]);
  });
});
