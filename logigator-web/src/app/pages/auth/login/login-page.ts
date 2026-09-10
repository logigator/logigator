import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ApiRequestError,
  emailSchema,
  isApiError,
  loginRequestSchema,
  resendVerificationRequestSchema
} from '@logigator/contract';
import { RETURN_PATH_PARAM, safeReturnPath } from '@logigator/core';
import { LgButton, LgFormField, LgInputText, LgMessage } from '@logigator/ui';
import { AuthApiService } from '../../../api/services/auth-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { applyServerFieldErrors, fieldError } from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { SiteLinks } from '../../../layout/site-links';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SessionService } from '../../../user/session.service';
import { AuthShell } from '../auth-shell';
import { GoogleSignIn } from '../google-sign-in';

/** What the API's Google round trip reports back on the return URL. */
const GOOGLE_ERRORS: Record<string, TranslationKey> = {
  google_failed: 'auth.googleErrors.failed',
  google_state_invalid: 'auth.googleErrors.stateInvalid',
  google_email_taken: 'auth.googleErrors.emailTaken',
  google_already_linked: 'auth.googleErrors.alreadyLinked'
};

/**
 * Signing in with an address and a password, or through Google.
 *
 * The unverified account is the one failure with something to offer: the API
 * distinguishes it from a wrong password precisely so a client can mail the
 * confirmation again, and the resend endpoint wants the same credentials the
 * form already holds — so the offer is a second button on this form rather
 * than a page of its own.
 */
@Component({
  selector: 'web-login-page',
  imports: [
    AuthShell,
    GoogleSignIn,
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    ReactiveFormsModule,
    RouterLink,
    TranslateDirective
  ],
  templateUrl: './login-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {
  private readonly authApi = inject(AuthApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly links = inject(SiteLinks);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, zodValidator(emailSchema)]
    }),
    // Only "not empty": an existing password has to match, and holding it to
    // today's rules would lock out an account that predates them — the same
    // reason the contract's login schema does not reuse `passwordSchema`.
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  protected readonly emailError = fieldError(this.form.controls.email, 'email');
  protected readonly passwordError = fieldError(
    this.form.controls.password,
    'password'
  );

  protected readonly submitting = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);
  /** The address is unconfirmed, so the form offers the mail again. */
  protected readonly unverified = signal(false);
  protected readonly verificationSent = signal(false);

  /** Where to go once signed in; anything but a path on this origin is dropped. */
  protected readonly returnPath = computed(() =>
    safeReturnPath(this.query()?.get(RETURN_PATH_PARAM))
  );

  /** A round trip through Google that came back with a reason instead. */
  protected readonly googleError = computed<TranslationKey | null>(() => {
    const failure = this.query()?.get('error');
    return failure ? (GOOGLE_ERRORS[failure] ?? 'forms.errors.unknown') : null;
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.reset();
    const body = loginRequestSchema.safeParse(this.form.getRawValue());
    if (!body.success || this.form.invalid) return;

    this.submitting.set(true);
    try {
      const user = await firstValueFrom(this.authApi.login(body.data));
      this.session.signedIn(user);
      await this.router.navigateByUrl(this.returnPath() ?? this.links.home());
    } catch (error) {
      this.reportLoginFailure(error);
    } finally {
      this.submitting.set(false);
    }
  }

  /** Mails the confirmation link again, for the account just refused. */
  protected async resendVerification(): Promise<void> {
    const body = resendVerificationRequestSchema.safeParse(
      this.form.getRawValue()
    );
    if (!body.success) return;

    this.submitting.set(true);
    try {
      await firstValueFrom(this.authApi.resendVerification(body.data));
      this.reset();
      this.verificationSent.set(true);
    } catch (error) {
      this.formError.set(genericFailureKey(error));
      this.unverified.set(false);
    } finally {
      this.submitting.set(false);
    }
  }

  private reportLoginFailure(error: unknown): void {
    if (isApiError(error, 'invalid_credentials')) {
      this.formError.set('pages.login.invalidCredentials');
      return;
    }
    if (isApiError(error, 'email_not_verified')) {
      this.formError.set('pages.login.notVerified');
      this.unverified.set(true);
      return;
    }
    if (
      error instanceof ApiRequestError &&
      error.code === 'validation_failed'
    ) {
      applyServerFieldErrors(this.form, error.details);
    }
    this.formError.set(genericFailureKey(error));
  }

  private reset(): void {
    this.formError.set(null);
    this.unverified.set(false);
    this.verificationSent.set(false);
  }
}
