import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../common/api-exception';
import type { UserRow } from '../database/schema';
import { UsersService } from '../users/users.service';
import '../session/session.types';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by {@link AuthGuard}; present exactly on routes it protects. */
    user?: UserRow;
  }
}

/**
 * Requires a signed-in session, and loads the account onto the request.
 *
 * Loading per request rather than trusting a copy in the session is what makes a
 * changed profile, a revoked address or a deleted account take effect at once —
 * the legacy `deserializeUser` did the same, for the same reason.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const userId = request.session?.userId;
    if (!userId) throw unauthorized();

    const user = await this.users.findById(userId);
    if (!user) {
      // The session outlived its account. Drop it, so the client stops sending
      // a cookie that can never resolve again.
      await request.session.destroy();
      throw unauthorized();
    }

    request.user = user;
    return true;
  }
}

function unauthorized(): ApiException {
  return new ApiException(
    HttpStatus.UNAUTHORIZED,
    'unauthorized',
    'Authentication required.'
  );
}

/**
 * The account behind the session, on a route guarded by {@link AuthGuard}.
 *
 * It throws rather than returning `undefined` when the guard did not run: a
 * handler reading the current user without requiring one is a wiring mistake,
 * and failing loudly beats serving somebody else's data.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserRow => {
    const { user } = context.switchToHttp().getRequest<FastifyRequest>();
    if (!user) {
      throw new Error(
        '@CurrentUser() requires the route to be guarded by AuthGuard.'
      );
    }
    return user;
  }
);
