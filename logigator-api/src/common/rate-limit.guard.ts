import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiException } from './api-exception';
import { RedisService } from '../redis/redis.service';

const RATE_LIMIT = 'rate-limit';

export interface RateLimitOptions {
  /** Attempts allowed per window, per client address. */
  limit: number;
  windowSeconds: number;
  /** Names the counter; endpoints that share a scope share a budget. */
  scope: string;
}

/**
 * Caps how often one address may call a handler, counting every request: it
 * suits endpoints whose cost is the request itself, such as a mail sent or a
 * report stored. A school behind one NAT is one address, so a limit has to
 * leave room for a classroom. Wrong passwords are budgeted where they are
 * checked, since only the handler knows an attempt failed.
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
    const hits = await this.redis.countInWindow(
      `rate:${options.scope}:${request.ip}`,
      options.windowSeconds
    );

    if (hits > options.limit) throw rateLimited();

    return true;
  }
}

export function rateLimited(): ApiException {
  return new ApiException(
    HttpStatus.TOO_MANY_REQUESTS,
    'rate_limited',
    'Too many attempts. Please try again later.'
  );
}
