import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import type { UpdateUserRequest, UserData } from '../models/user';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly path = '/api/user';
  private readonly api = inject(ApiBaseService);

  /** GET /api/user — current user with private data. */
  get(): Observable<UserData> {
    return this.api.get<UserData>(this.path);
  }

  /** PATCH /api/user — update username, email, password, or shortcuts. */
  update(body: UpdateUserRequest): Observable<UserData> {
    return this.api.patch<UserData>(this.path, body);
  }

  /**
   * GET /auth/logout — clears the server session and sets isAuthenticated cookie to false.
   * Uses fetch with redirect:manual so the 302 response doesn't navigate the page away.
   */
  async logout(): Promise<void> {
    await fetch('/auth/logout', { redirect: 'manual' });
  }
}
