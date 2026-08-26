import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { firstValueFrom, type Observable } from 'rxjs';
import { TranslationService } from '../translation/translation.service';
import { UserApiService } from '../api/services/user-api.service';
import type {
  UpdateUserRequest,
  UpdateUserResponse,
  UserResponse
} from '@logigator/contract';
import { isApiError } from '../api/api-error';
import { ToastService } from '../logging/toast.service';
import { CookieService } from '../storage/cookie.service';

const AUTH_COOKIE = 'isAuthenticated';

/**
 * The signed-in user's data, driven by the `isAuthenticated` cookie: the cookie
 * flipping true loads the user, flipping false clears it — so `user()` reflects
 * logins and logouts from anywhere (own tab, the login page, another tab,
 * session expiry). Everything that must *react* to a session change (library
 * reload, save guards, workspace teardown) keys off `user()`; the orchestration
 * itself lives in `SessionLifecycleService` and `CloudSessionService`.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly userApi = inject(UserApiService);
  private readonly toastService = inject(ToastService);
  private readonly cookieService = inject(CookieService);
  private readonly translation = inject(TranslationService);

  private readonly _hasAuthenticatedFlag = computed(
    () => this.cookieService.get(AUTH_COOKIE) === 'true'
  );

  private readonly _user = signal<UserResponse | null>(null);
  readonly user = this._user.asReadonly();

  constructor() {
    effect(() => {
      if (this._hasAuthenticatedFlag()) {
        this.loadUser();
      } else {
        this._user.set(null);
      }
    });
  }

  /** Fetch the current user from the API. Call once on init; 401 sets user to null. */
  loadUser(): void {
    this.userApi.get().subscribe({
      next: (user) => this._user.set(user),
      error: (err) => {
        // A rejected auth cookie means the server session is gone — flip to
        // signed-out cleanly (including the stale cookie, so a later login
        // produces a fresh cookie transition). Anything else (offline, 5xx)
        // leaves the cookie alone: the session may well still be valid.
        if (isApiError(err, 'unauthorized')) {
          this.sessionExpired();
          return;
        }
        this.toastService.error(
          this.translation.translate('user.loadFailed'),
          'UserService',
          err
        );
        this._user.set(null);
      }
    });
  }

  /** Open the login page in a new tab. */
  login(): void {
    window.open('/login', '_blank', 'noopener');
  }

  /**
   * Ends the server session (`POST /api/auth/logout`). Pure transport: throws on
   * failure and emits no toast — `SessionLifecycleService.requestLogout()` owns
   * the surrounding flow (unsaved-changes dialog, teardown, feedback). The
   * server response clears the `isAuthenticated` cookie, which clears `user()`.
   */
  logout(): Promise<void> {
    return firstValueFrom(this.userApi.logout());
  }

  /**
   * Flips to signed-out after the server rejected the session (a 401 on any
   * authenticated call) while the auth cookie still claimed otherwise. Clears
   * the stale cookie so the cookie signal agrees — and so the next login sets
   * it fresh and is observed as a real transition.
   */
  sessionExpired(): void {
    this.cookieService.delete(AUTH_COOKIE);
    this._user.set(null);
  }

  /** Open the account settings page in a new tab. */
  openAccountSettings(): void {
    window.open('/my/account/profile', '_blank', 'noopener');
  }

  /**
   * PATCH /api/user — update any combination of profile fields; updates the user
   * signal on success. An address change waits on the mail it sends, so the
   * updated account still carries the old address until the link is opened —
   * which is what `emailVerificationSent` tells the caller.
   */
  update(req: UpdateUserRequest): Observable<UpdateUserResponse> {
    return this.userApi
      .update(req)
      .pipe(tap((response) => this._user.set(response.user)));
  }
}
