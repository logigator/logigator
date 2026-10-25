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
 * Requires a signed-in session, and loads the account onto the request. Loading
 * per request rather than trusting a copy in the session is what makes a
 * changed profile or a deleted account take effect at once.
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
      // The session outlived its account. Signing out clears the cookies and
      // the account's session index; `destroy` alone leaves both behind, so the
      // client keeps sending a dead id and rendering a signed-in shell.
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
 * The account behind the session, on a route guarded by {@link AuthGuard}. It
 * throws rather than returning `undefined` when the guard did not run: reading
 * the current user without requiring one is a wiring mistake.
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
 * and personalize for whoever is there. The public community listings are the
 * case: requiring a session would make them private, and loading the row would
 * cost a query for a single boolean, so a session whose account is gone simply
 * personalizes nothing.
 *
 * Deliberately *not* a way to skip {@link AuthGuard}: anything that acts on the
 * account needs the row loaded and its existence established.
 */
export const SessionUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    return request.session?.userId ?? null;
  }
);
