import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ENV, type Env } from '../../config/env';
import { RedisService } from '../../redis/redis.service';
import { STORAGE_URL_PREFIX } from '../storage-layout';
import { CACHE_PURGE, type CachePurge } from './cache-purge';

/** Files waiting to be purged, scored by when they are next due. */
const DUE_KEY = 'cache-purge:due';
/** Failed purges in a row, per file. */
const FAILURES_KEY = 'cache-purge:failures';

/**
 * How long after its deletion a file is first due. A response the origin was
 * still sending when the file went is then cached before the purge, not after.
 */
export const CACHE_PURGE_SETTLE_MS = 30_000;
/**
 * How long a purge whose file is still on the volume waits before it looks
 * again. Such a file failed to delete, and the sweep collects it.
 */
const RECHECK_MS = 60 * 60_000;
const FIRST_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60_000;
/** Failures in a row from which a failed purge is logged as an error. */
const PERSISTENT_FAILURES = 5;
/**
 * Requests one drain sends at most. Four of 100 URLs stay under Cloudflare's
 * Free-plan limit of 800 URLs a second however fast they return.
 */
const REQUESTS_PER_DRAIN = 4;
const DRAIN_INTERVAL_MS = 10_000;

/**
 * Purges deleted files from the CDN, by exact URL, after the deletion.
 *
 * A file is queued in Redis before it is unlinked and purged once it is gone
 * from the volume, so neither a crash in between nor a CDN that is down loses a
 * purge, and none ever fails the request that deleted the file. A file still
 * on the volume waits for the sweep. A failed purge is retried with backoff,
 * indefinitely: the edge would otherwise serve the file for a year.
 *
 * Purging is idempotent, so two instances draining the same file cost one
 * redundant request and nothing else.
 */
@Injectable()
export class CachePurgeQueue implements BeforeApplicationShutdown {
  private readonly logger = new Logger(CachePurgeQueue.name);
  private readonly origin: string;
  private readonly root: string;
  private draining: Promise<void> | null = null;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(CACHE_PURGE) private readonly provider: CachePurge,
    private readonly redis: RedisService
  ) {
    // Caddy serves `/files` at the origin's root, whatever path the site has.
    this.origin = new URL(env.PUBLIC_URL).origin;
    this.root = resolve(env.STORAGE_DIR);
  }

  /** Files by their path under the storage root, before they are unlinked. */
  async enqueue(files: readonly string[], now = Date.now()): Promise<void> {
    if (files.length === 0) return;
    // `NX`: a file queued again keeps its place and its backoff.
    await this.redis.client.zAdd(
      this.redis.key(DUE_KEY),
      files.map((value) => ({ score: now + CACHE_PURGE_SETTLE_MS, value })),
      { condition: 'NX' }
    );
  }

  /** The address the CDN caches a file under. */
  private urlOf(file: string): string {
    return `${this.origin}${STORAGE_URL_PREFIX}/${file}`;
  }

  @Interval('cache-purge', DRAIN_INTERVAL_MS)
  async scheduled(): Promise<void> {
    if (this.draining) return;
    try {
      await this.drain();
    } catch (error) {
      this.logger.error('Draining cache purges failed', error);
    }
  }

  /** Purges what is due by `now`, after any drain already running. */
  async drain(now = Date.now()): Promise<void> {
    const previous = this.draining;
    const run = (async () => {
      await previous?.catch(() => undefined);
      await this.run(now);
    })();
    this.draining = run;
    try {
      await run;
    } finally {
      if (this.draining === run) this.draining = null;
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.draining?.catch(() => undefined);
  }

  private async run(now: number): Promise<void> {
    const due = this.redis.key(DUE_KEY);
    for (let requests = 0; requests < REQUESTS_PER_DRAIN;) {
      const files = await this.redis.client.zRangeByScore(due, '-inf', now, {
        LIMIT: { offset: 0, count: this.provider.batchSize }
      });
      if (files.length === 0) return;

      const { gone, present } = await this.partition(files);
      if (present.length > 0) await this.reschedule(present, now + RECHECK_MS);
      if (gone.length === 0) continue;

      requests += 1;
      const outcome = await this.provider.purge(
        gone.map((file) => this.urlOf(file))
      );
      if (!outcome.ok) {
        await this.failed(gone, outcome.reason, now);
        return;
      }
      await this.redis.client.zRem(due, gone);
      await this.redis.client.hDel(this.redis.key(FAILURES_KEY), gone);
    }
  }

  private async partition(
    files: readonly string[]
  ): Promise<{ gone: string[]; present: string[] }> {
    const gone: string[] = [];
    const present: string[] = [];
    for (const file of files) {
      try {
        await stat(join(this.root, file));
        present.push(file);
      } catch (error) {
        // Anything but its absence says nothing about whether it is gone.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') gone.push(file);
        else present.push(file);
      }
    }
    return { gone, present };
  }

  private async reschedule(files: readonly string[], at: number) {
    // `XX`: a file purged by another drain meanwhile stays purged.
    await this.redis.client.zAdd(
      this.redis.key(DUE_KEY),
      files.map((value) => ({ score: at, value })),
      { condition: 'XX' }
    );
  }

  private async failed(
    files: readonly string[],
    reason: string,
    now: number
  ): Promise<void> {
    const counting = this.redis.client.multi();
    for (const file of files) {
      counting.hIncrBy(this.redis.key(FAILURES_KEY), file, 1);
    }
    const failures = Math.max(...(await counting.exec()).map(Number));
    const delay = Math.min(
      FIRST_BACKOFF_MS * 2 ** (failures - 1),
      MAX_BACKOFF_MS
    );
    await this.reschedule(files, now + delay);

    const line = `Cache purge failed: provider=${this.provider.name} failures=${failures} urls=${files.length} retry_in_s=${delay / 1000} first=${this.urlOf(files[0])} reason=${JSON.stringify(reason)}`;
    if (failures >= PERSISTENT_FAILURES) this.logger.error(line);
    else this.logger.warn(line);
  }
}
