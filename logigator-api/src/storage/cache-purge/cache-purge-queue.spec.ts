import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { Env } from '../../config/env';
import type { RedisService } from '../../redis/redis.service';
import type { CachePurge, PurgeOutcome } from './cache-purge';
import { CACHE_PURGE_SETTLE_MS, CachePurgeQueue } from './cache-purge-queue';

/** The sorted-set and hash commands the queue sends, kept in memory. */
class FakeRedisClient {
  readonly sets = new Map<string, Map<string, number>>();
  readonly hashes = new Map<string, Map<string, number>>();

  private set(key: string): Map<string, number> {
    let set = this.sets.get(key);
    if (!set) this.sets.set(key, (set = new Map()));
    return set;
  }

  private hash(key: string): Map<string, number> {
    let hash = this.hashes.get(key);
    if (!hash) this.hashes.set(key, (hash = new Map()));
    return hash;
  }

  async zAdd(
    key: string,
    members: { score: number; value: string }[],
    options: { condition?: 'NX' | 'XX' } = {}
  ): Promise<number> {
    const set = this.set(key);
    for (const { score, value } of members) {
      if (options.condition === 'NX' && set.has(value)) continue;
      if (options.condition === 'XX' && !set.has(value)) continue;
      set.set(value, score);
    }
    return 0;
  }

  async zRangeByScore(
    key: string,
    _min: '-inf',
    max: number,
    options: { LIMIT: { offset: number; count: number } }
  ): Promise<string[]> {
    return [...this.set(key)]
      .filter(([, score]) => score <= max)
      .sort(([a, x], [b, y]) => x - y || a.localeCompare(b))
      .slice(options.LIMIT.offset, options.LIMIT.offset + options.LIMIT.count)
      .map(([value]) => value);
  }

  async zRem(key: string, members: string[]): Promise<number> {
    for (const member of members) this.set(key).delete(member);
    return 0;
  }

  async hDel(key: string, fields: string[]): Promise<number> {
    for (const field of fields) this.hash(key).delete(field);
    return 0;
  }

  multi() {
    const steps: (() => number)[] = [];
    const chain = {
      hIncrBy: (key: string, field: string, by: number) => {
        steps.push(() => {
          const value = (this.hash(key).get(field) ?? 0) + by;
          this.hash(key).set(field, value);
          return value;
        });
        return chain;
      },
      exec: async () => steps.map((step) => step())
    };
    return chain;
  }
}

/** A provider that records each request and answers from a script. */
class RecordingPurge implements CachePurge {
  readonly name = 'recording';
  readonly batchSize = 100;
  readonly requests: string[][] = [];
  answer: PurgeOutcome = { ok: true };

  purge(urls: readonly string[]): Promise<PurgeOutcome> {
    this.requests.push([...urls]);
    return Promise.resolve(this.answer);
  }
}

const SETTLED = CACHE_PURGE_SETTLE_MS;

describe('CachePurgeQueue', () => {
  let root: string;
  let redis: FakeRedisClient;
  let provider: RecordingPurge;
  let queue: CachePurgeQueue;
  const start = Date.UTC(2026, 9, 26);

  function files(count: number): string[] {
    return Array.from(
      { length: count },
      (_, index) =>
        `preview/ab/${String(index).padStart(4, '0')}/light-512.webp`
    );
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'logigator-purge-'));
    redis = new FakeRedisClient();
    provider = new RecordingPurge();
    queue = new CachePurgeQueue(
      // A site under a path still serves `/files` at the origin's root.
      { PUBLIC_URL: 'https://logigator.com/app', STORAGE_DIR: root } as Env,
      provider,
      {
        client: redis,
        key: (...parts: string[]) => parts.join(':')
      } as unknown as RedisService
    );
    vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
    vi.spyOn(Logger.prototype, 'error').mockReturnValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it('purges a file by its absolute URL once its deletion has settled', async () => {
    await queue.enqueue(['profile/a3/a3f1/64.webp'], start);

    await queue.drain(start + SETTLED - 1);
    expect(provider.requests).toEqual([]);

    await queue.drain(start + SETTLED);
    expect(provider.requests).toEqual([
      ['https://logigator.com/files/profile/a3/a3f1/64.webp']
    ]);

    // Purged is done with.
    await queue.drain(start + 10 * SETTLED);
    expect(provider.requests).toHaveLength(1);
  });

  it('sends batches the provider takes, and no more requests per drain than the rate allows', async () => {
    const queued = files(450);
    await queue.enqueue(queued, start);

    await queue.drain(start + SETTLED);
    expect(provider.requests.map((urls) => urls.length)).toEqual([
      100, 100, 100, 100
    ]);

    await queue.drain(start + SETTLED);
    expect(provider.requests.map((urls) => urls.length)).toEqual([
      100, 100, 100, 100, 50
    ]);

    // Every file exactly once.
    const sent = provider.requests.flat();
    expect(new Set(sent).size).toBe(sent.length);
    expect(sent.sort()).toEqual(
      queued.map((file) => `https://logigator.com/files/${file}`).sort()
    );
  });

  it('waits while the file is still on the volume', async () => {
    const [file] = files(1);
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), 'not unlinked yet');
    await queue.enqueue([file], start);

    await queue.drain(start + SETTLED);
    expect(provider.requests).toEqual([]);

    // The sweep takes it; the purge follows at the next look, not before.
    await rm(join(root, file));
    await queue.drain(start + SETTLED + 1000);
    expect(provider.requests).toEqual([]);
    await queue.drain(start + SETTLED + 2 * 60 * 60_000);
    expect(provider.requests).toHaveLength(1);
  });

  it('retries a failed purge with growing backoff until it succeeds', async () => {
    await queue.enqueue(files(100), start);
    provider.answer = { ok: false, reason: 'Cloudflare answered 503' };

    let now = start + SETTLED;
    await queue.drain(now);
    expect(provider.requests).toHaveLength(1);

    // 30 s, then twice as long after each failure in a row.
    for (const backoff of [30_000, 60_000, 120_000, 240_000]) {
      const sent = provider.requests.length;
      await queue.drain(now + backoff - 1000);
      expect(provider.requests).toHaveLength(sent);
      now += backoff;
      await queue.drain(now);
      expect(provider.requests).toHaveLength(sent + 1);
    }
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringMatching(/provider=recording failures=5 urls=100 /)
    );

    provider.answer = { ok: true };
    await queue.drain(now + 480_000);
    expect(provider.requests).toHaveLength(6);
    expect(redis.sets.get('cache-purge:due')?.size).toBe(0);
    expect(redis.hashes.get('cache-purge:failures')?.size).toBe(0);
  });

  it('ends a drain at the first failure', async () => {
    await queue.enqueue(files(250), start);
    provider.answer = { ok: false, reason: 'Cloudflare unreachable' };

    await queue.drain(start + SETTLED);

    expect(provider.requests).toHaveLength(1);
  });
});
