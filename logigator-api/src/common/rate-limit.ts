import { HttpStatus } from '@nestjs/common';
import type { RedisService } from '../redis/redis.service';
import { ApiException } from './api-exception';

/** A counter and the hits it allows per window. */
export interface Budget {
  key: string;
  limit: number;
}

type Counters = Pick<RedisService, 'countInWindows' | 'uncountInWindows'>;

/**
 * Counts a hit against every budget, or refuses it and counts it against none:
 * a refused hit never reached what the budgets protect, and leaving it counted
 * would spend the budgets that still had room.
 */
export async function spendBudgets(
  redis: Counters,
  budgets: Budget[],
  windowSeconds: number
): Promise<void> {
  const keys = budgets.map((budget) => budget.key);
  const counts = await redis.countInWindows(keys, windowSeconds);
  if (budgets.some((budget, index) => (counts[index] ?? 0) > budget.limit)) {
    await redis.uncountInWindows(keys, windowSeconds);
    throw rateLimited();
  }
}

/** Takes back a hit {@link spendBudgets} counted. */
export async function refundBudgets(
  redis: Counters,
  budgets: Budget[],
  windowSeconds: number
): Promise<void> {
  await redis.uncountInWindows(
    budgets.map((budget) => budget.key),
    windowSeconds
  );
}

export function rateLimited(): ApiException {
  return new ApiException(
    HttpStatus.TOO_MANY_REQUESTS,
    'rate_limited',
    'Too many attempts. Please try again later.'
  );
}
