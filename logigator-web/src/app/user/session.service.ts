import { inject, Injectable, makeStateKey, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { UserResponse } from '@logigator/contract';
import { UserApiService } from '../api/services/user-api.service';
import { CookieService } from '../storage/cookie.service';
import { isApiError } from '@logigator/contract';
import { TransferHandoffService } from '../transfer/transfer-handoff.service';

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
 * over through {@link TransferHandoffService}, so hydration neither flickers
 * nor repeats the request. The hand-off is consume-once, so a later
 * client-side resolve asks again rather than replaying an answer from page
 * load.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly userApi = inject(UserApiService);
  private readonly cookies = inject(CookieService);
  private readonly handoff = inject(TransferHandoffService);

  private readonly _user = signal<UserResponse | null>(null);

  /** The signed-in account, or `null` for an anonymous visitor. */
  public readonly user = this._user.asReadonly();

  /**
   * Resolves the account behind the request, if the hint cookie says there is
   * one.
   */
  public async resolve(): Promise<void> {
    this._user.set(
      await this.handoff.resolve(SESSION_STATE, () => this.fetchUser())
    );
  }

  /** Ends the server session. The response clears the hint cookie. */
  public async logout(): Promise<void> {
    await firstValueFrom(this.userApi.logout());
    this._user.set(null);
  }

  /**
   * Asks the API who the session belongs to. Never throws — the site is
   * readable signed out, so an API that is down costs the personalization,
   * not the page — which also means a server render transfers the anonymous
   * answer instead of making the browser repeat a failed request.
   */
  private async fetchUser(): Promise<UserResponse | null> {
    if (this.cookies.get(AUTH_HINT_COOKIE) !== 'true') {
      return null;
    }

    try {
      return await firstValueFrom(this.userApi.get());
    } catch (err) {
      // A rejected hint means the session is gone; clearing it keeps the next
      // page view from paying for the same 401. Anything else — offline, 5xx —
      // leaves it alone: the session may well still be valid.
      if (isApiError(err, 'unauthorized')) {
        this.cookies.delete(AUTH_HINT_COOKIE);
      }
      return null;
    }
  }
}
