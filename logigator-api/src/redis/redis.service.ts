import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { REDIS, type RedisClient } from './redis.client';

/**
 * Redis access, namespaced. Every key goes through {@link key}, because
 * development shares one Redis instance with the legacy backend and an
 * unprefixed `sess:<id>` would be ambiguous between the two. The helpers cover
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
    const namespaced = this.key(key);
    const [count] = await this.client
      .multi()
      .incr(namespaced)
      .expire(namespaced, windowSeconds, 'NX')
      .exec();
    return Number(count);
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
