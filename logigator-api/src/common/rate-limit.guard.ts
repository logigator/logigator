import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { RedisService } from '../redis/redis.service';
import { spendBudgets } from './rate-limit';

const RATE_LIMIT = 'rate-limit';

export interface RateLimitOptions {
  /** Attempts allowed per window, per client address. */
  limit: number;
  windowSeconds: number;
  /** Names the counter; endpoints that share a scope share a budget. */
  scope: string;
}

/**
 * Caps how often one address may call a handler, counting every request it
 * lets through: it suits endpoints whose cost is the request itself, such as a
 * mail sent or a report stored. A school behind one NAT is one address, so a
 * limit has to leave room for a classroom. Wrong passwords are budgeted where
 * they are checked, since only the handler knows an attempt failed.
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT, options);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT,
      context.getHandler()
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    await spendBudgets(
      this.redis,
      [{ key: `rate:${options.scope}:${request.ip}`, limit: options.limit }],
      options.windowSeconds
    );

    return true;
  }
}
