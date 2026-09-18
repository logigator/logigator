import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  updateUserResponseSchema,
  userResponseSchema,
  type DeleteUserRequest,
  type UpdateUserRequest,
  type UpdateUserResponse,
  type UserResponse
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly api = inject(ApiBaseService);

  /** GET /api/user — the signed-in account, 401 without a session. */
  public get(): Observable<UserResponse> {
    return this.api.get('/api/user', userResponseSchema);
  }

  /**
   * PATCH /api/user. A partial update; changing the password or the address of
   * an account that has one needs `currentPassword` beside it. An address
   * change only mails a confirmation — the account keeps the old address until
   * that link is opened, which `emailVerificationSent` reports.
   */
  public update(body: UpdateUserRequest): Observable<UpdateUserResponse> {
    return this.api.patch('/api/user', updateUserResponseSchema, body);
  }

  /**
   * POST /api/user/avatar. Multipart rather than JSON: base64 in a body would
   * inflate the file by a third for nothing. `HttpClient` leaves the content
   * type alone for a `FormData` body, so the browser writes the boundary.
   */
  public setAvatar(file: File): Observable<UserResponse> {
    const body = new FormData();
    body.append('file', file);
    return this.api.post('/api/user/avatar', userResponseSchema, body);
  }

  /** DELETE /api/user/avatar — the account falls back to its initials. */
  public removeAvatar(): Observable<UserResponse> {
    return this.api.delete('/api/user/avatar', userResponseSchema);
  }

  /**
   * DELETE /api/user. Takes the account's password where it has one; the
   * response ends the session with it, so nothing is left to sign out of.
   */
  public deleteAccount(body: DeleteUserRequest): Observable<void> {
    return this.api.deleteWithBody('/api/user', body);
  }

  /**
   * DELETE /api/auth/google — detaches the linked identity, answering the
   * account as it now stands. Refused where the account has no password: Google
   * would be the only way back in.
   */
  public unlinkGoogle(): Observable<UserResponse> {
    return this.api.delete('/api/auth/google', userResponseSchema);
  }

  /**
   * POST /api/auth/logout — ends the server session. Answers 204 whether or not
   * there was one, so a client holding a stale hint cookie can clear itself.
   */
  public logout(): Observable<void> {
    return this.api.postEmpty('/api/auth/logout');
  }
}
