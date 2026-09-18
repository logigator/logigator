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
 * Caps how often one address may call a handler. Applied to the endpoints that
 * take credentials or send mail — password guessing and using someone else's
 * address as a mail relay are what an unauthenticated caller can do at volume.
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

    if (hits > options.limit) {
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'rate_limited',
        'Too many attempts. Please try again later.'
      );
    }

    return true;
  }
}
