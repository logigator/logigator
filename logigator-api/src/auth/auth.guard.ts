import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiException } from '../common/api-exception';
import type { UserRow } from '../database/schema';
import { SessionService } from '../session/session.service';
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
  constructor(
    private readonly users: UsersService,
    private readonly session: SessionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const userId = request.session?.userId;
    if (!userId) throw unauthorized();

    const user = await this.users.findById(userId);
    if (!user) {
      // The session outlived its account, and no later request can resolve it
      // either. Signing out is what clears the cookies and the account's
      // session index — `destroy` alone leaves both behind, so the client keeps
      // sending a dead id and rendering a signed-in shell.
      await this.session.signOut(request, http.getResponse<FastifyReply>());
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

/**
 * The signed-in account's id, or `null` — for the routes that serve everybody
 * and personalize for whoever is there.
 *
 * The public community listings are the case: they answer the same rows to a
 * visitor as to an account, plus whether that account has starred each one.
 * Requiring a session would make them private; loading the row would cost a
 * query for a single boolean. So this reads the session and nothing else, and a
 * session whose account is gone simply personalizes nothing.
 *
 * It is deliberately *not* a way to skip {@link AuthGuard}. Anything that acts
 * on the account behind the session — a write, or reading something private —
 * needs the row loaded and its existence established, which is the guard's job.
 */
export const SessionUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    return request.session?.userId ?? null;
  }
);
