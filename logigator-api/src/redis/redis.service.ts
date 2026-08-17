import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { REDIS, type RedisClient } from './redis.client';

/**
 * Redis access, namespaced.
 *
 * Every key this API writes goes through {@link key}, because development shares
 * one Redis instance with the legacy backend until cutover — an unprefixed
 * `sess:<id>` would be ambiguous between the two. The helpers below are the
 * handful of shapes the API actually uses (sessions, short-lived verification
 * and reset tokens, fixed-window counters); anything more exotic can reach for
 * {@link client} directly.
 */
@Injectable()
export class RedisService {
  private readonly prefix: string;

  constructor(
    @Inject(REDIS) readonly client: RedisClient,
    @Inject(ENV) env: Env
  ) {
    this.prefix = env.REDIS_KEY_PREFIX;
  }

  /** Namespaces a logical key. */
  key(...parts: string[]): string {
    return this.prefix + parts.join(':');
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.key(key));
  }

  /** Writes a value that expires on its own; there is no unbounded `set`. */
  async setEx(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(this.key(key), value, {
      expiration: { type: 'EX', value: ttlSeconds }
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.key(key));
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // A value that does not parse is indistinguishable from an expired one for
      // every caller here, and treating it as absent keeps a corrupt entry from
      // failing requests until it expires.
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number
  ): Promise<void> {
    await this.setEx(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Reads a value and deletes it in one command, so it is usable at most once
   * even when two requests arrive together — what a one-shot mail token needs.
   */
  async takeJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.getDel(this.key(key));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Atomically counts a hit in a fixed window and returns the count so far. The
   * expiry is set when the counter is created, so the window starts with its
   * first hit and the key disappears on its own.
   */
  async countInWindow(key: string, windowSeconds: number): Promise<number> {
    const namespaced = this.key(key);
    const count = await this.client.incr(namespaced);
    if (count === 1) {
      await this.client.expire(namespaced, windowSeconds);
    }
    return count;
  }
}
