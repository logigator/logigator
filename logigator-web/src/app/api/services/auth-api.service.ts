import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  loginResponseSchema,
  registerResponseSchema,
  type ConfirmPasswordReset,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterResponse,
  type RequestPasswordReset,
  type ResendVerificationRequest,
  type VerifyEmailRequest
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

/**
 * The credential endpoints under `/api/auth`. Requests are the contract's own
 * inferred types, which is what makes a form's parsed output the body without a
 * shape of its own in between.
 *
 * Google sign-in is not here: it is a browser round trip through redirects, so
 * a page links to `/api/auth/google` rather than calling it.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiBaseService);

  /** POST /api/auth/login — starts the session and answers the account. */
  public login(body: LoginRequest): Observable<LoginResponse> {
    return this.api.post('/api/auth/login', loginResponseSchema, body);
  }

  /**
   * POST /api/auth/register — creates the account and mails it a confirmation
   * link. Signing in stays refused until that link is opened.
   */
  public register(body: RegisterRequest): Observable<RegisterResponse> {
    return this.api.post('/api/auth/register', registerResponseSchema, body);
  }

  /**
   * POST /api/auth/resend-verification — needs the credentials, so it cannot be
   * used to mail an address on somebody else's behalf.
   */
  public resendVerification(body: ResendVerificationRequest): Observable<void> {
    return this.api.postEmpty('/api/auth/resend-verification', body);
  }

  /** POST /api/auth/verify-email — redeems the link from a confirmation mail. */
  public verifyEmail(body: VerifyEmailRequest): Observable<void> {
    return this.api.postEmpty('/api/auth/verify-email', body);
  }

  /**
   * POST /api/auth/password-reset — mails a reset link. Answers the same
   * whether or not the address has an account, so the page must not report one
   * either.
   */
  public requestPasswordReset(body: RequestPasswordReset): Observable<void> {
    return this.api.postEmpty('/api/auth/password-reset', body);
  }

  /** POST /api/auth/password-reset/confirm — sets the new password. */
  public confirmPasswordReset(body: ConfirmPasswordReset): Observable<void> {
    return this.api.postEmpty('/api/auth/password-reset/confirm', body);
  }
}
