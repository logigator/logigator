import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { userResponseSchema, type UserResponse } from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly api = inject(ApiBaseService);

  /** GET /api/user — the signed-in account, 401 without a session. */
  public get(): Observable<UserResponse> {
    return this.api.get('/api/user', userResponseSchema);
  }

  /**
   * POST /api/auth/logout — ends the server session. Answers 204 whether or not
   * there was one, so a client holding a stale hint cookie can clear itself.
   */
  public logout(): Observable<void> {
    return this.api.postEmpty('/api/auth/logout');
  }
}
