import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { rateLimited } from '../common/rate-limit.guard';
import { RedisService } from '../redis/redis.service';
import { normalizeEmail } from '../users/users.service';

const WINDOW_SECONDS = 600;
/** Wrong passwords one client address may try against one account. */
const PER_ACCOUNT = 10;
/** Wrong passwords one client address may try in all, across accounts. */
const PER_ADDRESS = 100;

/**
 * Budgets for wrong passwords. Only failures count, so a classroom behind one
 * address signs in freely, while guessing at one account or spraying one
 * password across many runs out. Once either budget is spent the address is
 * refused even with the right password: answering a correct guess differently
 * would tell the guesser it was correct.
 */
@Injectable()
export class LoginAttemptsService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Counts an attempt as failed before its password is checked, so a burst of
   * parallel guesses cannot all pass while none has failed yet. An attempt that
   * does not fail takes its count back through {@link forgive}; until then it
   * holds a place in both budgets.
   */
  async admit(ip: string, email: string): Promise<void> {
    const keys = failureKeys(ip, email);
    const [perAccount = 0, perAddress = 0] = await this.redis.countInWindows(
      keys,
      WINDOW_SECONDS
    );
    if (perAccount > PER_ACCOUNT || perAddress > PER_ADDRESS) {
      // A refused attempt never reached a password, so it is no failure.
      await this.redis.uncountInWindows(keys, WINDOW_SECONDS);
      throw rateLimited();
    }
  }

  async forgive(ip: string, email: string): Promise<void> {
    await this.redis.uncountInWindows(failureKeys(ip, email), WINDOW_SECONDS);
  }
}

/** The account is keyed by a hash of its address, never the address itself. */
export function failureKeys(ip: string, email: string): [string, string] {
  const account = createHash('sha256')
    .update(normalizeEmail(email))
    .digest('base64url');
  return [
    `rate:login-failures:account:${account}:${ip}`,
    `rate:login-failures:address:${ip}`
  ];
}
