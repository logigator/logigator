import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { UserApiService } from '../api/services/user-api.service';
import type { Shortcut, UpdateUserRequest, UserData } from '../api/models/user';
import { ToastService } from '../logging/toast.service';
import { CookieService } from '../storage/cookie.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly userApi = inject(UserApiService);
  private readonly toastService = inject(ToastService);
  private readonly cookieService = inject(CookieService);

  private readonly _hasAuthenticatedFlag = computed(
    () => this.cookieService.get('isAuthenticated') === 'true'
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
      error: () => {
        this.toastService.error(
          'Failed to load user data. Please log in again.'
        );
        this._user.set(null);
      }
    });
  }

  /** Open the login page in a new tab. */
  login(): void {
    window.open('/login', '_blank');
  }

  /** Navigate to the logout endpoint, which clears the session and redirects to home. */
  logout(): void {
    this.userApi
      .logout()
      .then(() => {
        this.toastService.success('Logged out successfully.');
      })
      .catch(() => {
        this.toastService.error('Failed to log out. Please try again.');
      });
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
