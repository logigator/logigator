import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  updateUserResponseSchema,
  userResponseSchema,
  type UpdateUserRequest,
  type UpdateUserResponse,
  type UserResponse
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly path = '/api/user';
  private readonly api = inject(ApiBaseService);

  /** GET /api/user — the signed-in account. */
  get(): Observable<UserResponse> {
    return this.api.get(this.path, userResponseSchema);
  }

  /** PATCH /api/user — username, address or password. */
  update(body: UpdateUserRequest): Observable<UpdateUserResponse> {
    return this.api.patch(this.path, updateUserResponseSchema, body);
  }

  /**
   * POST /api/auth/logout — ends the server session. Answers 204 whether or not
   * there was one, so a client holding a stale hint cookie can clear itself,
   * and nothing navigates.
   */
  logout(): Observable<void> {
    return this.api.postEmpty('/api/auth/logout');
  }
}
