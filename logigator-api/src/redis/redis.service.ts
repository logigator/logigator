import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { REDIS, type RedisClient } from './redis.client';

/**
 * Redis access, namespaced. Every key goes through {@link key}, so the API can
 * share a Redis instance with another application whose unprefixed `sess:<id>`
 * would otherwise be ambiguous with its own. The helpers cover
 * the shapes the API uses; anything else reaches for {@link client} directly.
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

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.del(keys.map((key) => this.key(key)));
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // A value that does not parse is indistinguishable from an expired one
      // for every caller here, so a corrupt entry reads as absent.
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
   * window starts with its first hit and the key disappears on its own.
   *
   * Both commands travel in one transaction: a process dying between two round
   * trips would leave a counter with no TTL, rate limiting its address for
   * good. The expiry is `NX`, which heals such a key on its next hit rather
   * than sliding the window of a client that keeps knocking.
   */
  async countInWindow(key: string, windowSeconds: number): Promise<number> {
    const [count = 0] = await this.countInWindows([key], windowSeconds);
    return count;
  }

  /** {@link countInWindow} for several counters, all in one transaction. */
  async countInWindows(
    keys: string[],
    windowSeconds: number
  ): Promise<number[]> {
    return this.stepWindows(keys, windowSeconds, 1);
  }

  /**
   * Takes back a hit {@link countInWindows} counted. A window that ended in
   * between starts over at -1 with a fresh expiry, which is one hit of slack
   * rather than a counter that never expires.
   */
  async uncountInWindows(keys: string[], windowSeconds: number): Promise<void> {
    await this.stepWindows(keys, windowSeconds, -1);
  }

  private async stepWindows(
    keys: string[],
    windowSeconds: number,
    step: 1 | -1
  ): Promise<number[]> {
    const multi = this.client.multi();
    for (const key of keys) {
      const namespaced = this.key(key);
      if (step === 1) multi.incr(namespaced);
      else multi.decr(namespaced);
      multi.expire(namespaced, windowSeconds, 'NX');
    }
    const replies = await multi.exec();
    return keys.map((_, index) => Number(replies[index * 2]));
  }

  /**
   * Adds a member to a set and pushes the set's expiry out, in one transaction.
   * The expiry is unconditional: the set indexes things that expire on their
   * own, so it has to outlive its newest member.
   */
  async addToSet(
    key: string,
    member: string,
    ttlSeconds: number
  ): Promise<void> {
    const namespaced = this.key(key);
    await this.client
      .multi()
      .sAdd(namespaced, member)
      .expire(namespaced, ttlSeconds)
      .exec();
  }

  async membersOf(key: string): Promise<string[]> {
    return this.client.sMembers(this.key(key));
  }

  async removeFromSet(key: string, members: string[]): Promise<void> {
    if (members.length === 0) return;
    await this.client.sRem(this.key(key), members);
  }
}
