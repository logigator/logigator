import {
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  signal,
  TransferState
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type { UserResponse } from '@logigator/contract';
import { UserApiService } from '../api/services/user-api.service';
import { CookieService } from '../storage/cookie.service';
import { isApiError } from '@logigator/contract';

/**
 * Non-httpOnly cookie the API keeps in step with the session cookie. It carries
 * no authority — the session cookie does — but it tells a client whether asking
 * for the account is worth a request, which keeps an anonymous page view from
 * spending one on a guaranteed 401.
 */
const AUTH_HINT_COOKIE = 'isAuthenticated';

/** Where the server render leaves the account for the browser to pick up. */
const SESSION_STATE = makeStateKey<UserResponse | null>('session.user');

/**
 * Who is viewing the page, resolved once before the first render so the top bar
 * is personalized in the server's first byte: the render forwards the visitor's
 * session cookie on its API hop (`apiOriginInterceptor`) and hands the answer
 * over in the transfer state, so hydration neither flickers nor repeats it.
 *
 * The hand-off is explicit rather than Angular's HTTP transfer cache, which
 * cannot cover these requests: it treats a `cookie` header as an authorization
 * header and skips them, and it keys on the URL the interceptor has already
 * rewritten onto the API's own origin.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly userApi = inject(UserApiService);
  private readonly cookies = inject(CookieService);
  private readonly transferState = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  private readonly _user = signal<UserResponse | null>(null);

  /** The signed-in account, or `null` for an anonymous visitor. */
  public readonly user = this._user.asReadonly();

  /**
   * Resolves the account behind the request, if the hint cookie says there is
   * one. Failures are swallowed: the site is readable signed out, so an API
   * that is down costs the personalization, not the page.
   */
  public async resolve(): Promise<void> {
    if (this.transferState.hasKey(SESSION_STATE)) {
      this._user.set(this.transferState.get(SESSION_STATE, null));
      // Consumed: a later client-side resolve must ask again rather than
      // replay an answer from page load.
      this.transferState.remove(SESSION_STATE);
      return;
    }

    if (this.cookies.get(AUTH_HINT_COOKIE) !== 'true') {
      this.publish(null);
      return;
    }

    try {
      this.publish(await firstValueFrom(this.userApi.get()));
    } catch (err) {
      this.publish(null);
      // A rejected hint means the session is gone; clearing it keeps the next
      // page view from paying for the same 401. Anything else — offline, 5xx —
      // leaves it alone: the session may well still be valid.
      if (isApiError(err, 'unauthorized')) {
        this.cookies.delete(AUTH_HINT_COOKIE);
      }
    }
  }

  /** Ends the server session. The response clears the hint cookie. */
  public async logout(): Promise<void> {
    await firstValueFrom(this.userApi.logout());
    this._user.set(null);
  }

  private publish(user: UserResponse | null): void {
    this._user.set(user);
    if (this.isServer) {
      this.transferState.set(SESSION_STATE, user);
    }
  }
}
