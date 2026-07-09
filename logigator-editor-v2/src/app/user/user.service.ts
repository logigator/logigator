import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { UserApiService } from '../api/services/user-api.service';
import type { Shortcut, UpdateUserRequest, UserData } from '../api/models/user';
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

  private readonly _hasAuthenticatedFlag = computed(
    () => this.cookieService.get(AUTH_COOKIE) === 'true'
  );

  private readonly _user = signal<UserData | null>(null);
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
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.sessionExpired();
          return;
        }
        this.toastService.error(
          'Failed to load user data. Please log in again.',
          'UserService'
        );
        this._user.set(null);
      }
    });
  }

  /** Open the login page in a new tab. */
  login(): void {
    window.open('/login', '_blank');
  }

  /**
   * Ends the server session (GET `/auth/logout`). Pure transport: throws on
   * failure and emits no toast — `SessionLifecycleService.requestLogout()` owns
   * the surrounding flow (unsaved-changes dialog, teardown, feedback). The
   * server response flips the `isAuthenticated` cookie, which clears `user()`.
   */
  logout(): Promise<void> {
    return this.userApi.logout();
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
    window.open('/my/account/profile', '_blank');
  }

  /** PATCH /api/user — update any combination of profile fields; updates the user signal on success. */
  update(req: UpdateUserRequest): Observable<UserData> {
    return this.userApi.update(req).pipe(tap((user) => this._user.set(user)));
  }

  /** Convenience wrapper for persisting keyboard shortcut bindings to the server. */
  updateShortcuts(shortcuts: Shortcut[]): Observable<UserData> {
    return this.update({ shortcuts });
  }
}
