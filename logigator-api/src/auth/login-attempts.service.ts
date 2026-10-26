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
 * Wrong passwords a signed-in account's sessions may try against it, from
 * every address together.
 */
const PER_SIGNED_IN_ACCOUNT = 10;

/** The account a password is checked for. */
export interface PasswordAccount {
  email: string;
  /**
   * Set where a session proves itself to its own account. A stolen session
   * cookie can be used from any address but only for its account, so these
   * checks also share one budget across addresses. A sign-in has none: there
   * it would let anyone lock any account out.
   */
  signedInAs?: string;
}

interface Budget {
  key: string;
  limit: number;
}

/**
 * Budgets for wrong passwords. Only failures count, so a classroom behind one
 * address signs in freely, while guessing at one account or spraying one
 * password across many runs out. Once a budget is spent the address is
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
   * holds a place in every budget.
   */
  async admit(ip: string, account: PasswordAccount): Promise<void> {
    const budgets = failureBudgets(ip, account);
    const keys = budgets.map((budget) => budget.key);
    const counts = await this.redis.countInWindows(keys, WINDOW_SECONDS);
    if (budgets.some((budget, index) => (counts[index] ?? 0) > budget.limit)) {
      // A refused attempt never reached a password, so it is no failure.
      await this.redis.uncountInWindows(keys, WINDOW_SECONDS);
      throw rateLimited();
    }
  }

  async forgive(ip: string, account: PasswordAccount): Promise<void> {
    await this.redis.uncountInWindows(
      failureBudgets(ip, account).map((budget) => budget.key),
      WINDOW_SECONDS
    );
  }
}

/**
 * The account is keyed by a hash of its address, never the address itself,
 * and a sign-in shares that key with a session's check of the same account.
 */
export function failureBudgets(
  ip: string,
  { email, signedInAs }: PasswordAccount
): Budget[] {
  const account = createHash('sha256')
    .update(normalizeEmail(email))
    .digest('base64url');
  const budgets = [
    { key: `rate:login-failures:account:${account}:${ip}`, limit: PER_ACCOUNT },
    { key: `rate:login-failures:address:${ip}`, limit: PER_ADDRESS }
  ];
  if (signedInAs !== undefined) {
    budgets.push({
      key: `rate:login-failures:signed-in:${signedInAs}`,
      limit: PER_SIGNED_IN_ACCOUNT
    });
  }
  return budgets;
}
