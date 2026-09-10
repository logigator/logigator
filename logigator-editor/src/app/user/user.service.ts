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
import { isApiError } from '@logigator/contract';
import { ToastService } from '../logging/toast.service';
import { CookieService } from '../storage/cookie.service';

const AUTH_COOKIE = 'isAuthenticated';

/**
 * The signed-in user's data, driven by the `isAuthenticated` cookie, so
 * `user()` reflects logins and logouts from anywhere: own tab, the login page,
 * another tab, session expiry. Everything reacting to a session change keys off
 * `user()`; the orchestration lives in `SessionLifecycleService` and
 * `CloudSessionService`.
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

  /** Fetches the current user; a 401 sets the user to null. */
  loadUser(): void {
    this.userApi.get().subscribe({
      next: (user) => this._user.set(user),
      error: (err) => {
        // A rejected auth cookie means the server session is gone, so clear
        // the stale cookie too and a later login reads as a real transition.
        // Anything else (offline, 5xx) leaves the cookie alone: the session
        // may well still be valid.
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

  /** Open the registration page in a new tab. */
  register(): void {
    window.open('/register', '_blank', 'noopener');
  }

  /**
   * Ends the server session. Pure transport: throws on failure and emits no
   * toast; `SessionLifecycleService` owns the surrounding flow. The server
   * response clears the `isAuthenticated` cookie, which clears `user()`.
   */
  logout(): Promise<void> {
    return firstValueFrom(this.userApi.logout());
  }

  /**
   * Flips to signed-out after a 401 while the auth cookie still claimed
   * otherwise. Clearing the stale cookie makes the cookie signal agree and lets
   * the next login be observed as a real transition.
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
   * Updates any combination of profile fields. An address change waits on the
   * mail it sends, so the account keeps the old address until the link is
   * opened; `emailVerificationSent` reports that.
   */
  update(req: UpdateUserRequest): Observable<UpdateUserResponse> {
    return this.userApi
      .update(req)
      .pipe(tap((response) => this._user.set(response.user)));
  }
}
