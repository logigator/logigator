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
  confirmPasswordResetSchema,
  emailSchema,
  isApiError,
  passwordSchema,
  requestPasswordResetSchema
} from '@logigator/contract';
import {
  LgButton,
  LgFormField,
  LgInputText,
  LgMessage,
  ToastService
} from '@logigator/ui';
import { AuthApiService } from '../../../api/services/auth-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { fieldError, passwordsMatch } from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { SiteLinks } from '../../../layout/site-links';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslationService } from '../../../translation/translation.service';
import { AuthShell } from '../auth-shell';

/** Query parameter the reset mail's link carries the token in. */
const TOKEN_PARAM = 'token';

/**
 * Both halves of a password reset, told apart by the token in the URL: without
 * one the page asks for an address, with one it takes the new password. The
 * mail links straight here, so the two cannot be separate routes.
 *
 * Asking for a link has no failure to report. The API answers the same whether
 * or not the address has an account — otherwise the form would be a way to
 * probe which addresses are registered — so the confirmation is worded to cover
 * both cases.
 */
@Component({
  selector: 'web-reset-password-page',
  imports: [
    AuthShell,
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    ReactiveFormsModule,
    RouterLink,
    TranslateDirective
  ],
  templateUrl: './reset-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordPage {
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly links = inject(SiteLinks);

  /** The token from the mail, or `null` on the page reached from the login form. */
  protected readonly token = computed(
    () => this.query()?.get(TOKEN_PARAM) ?? null
  );

  protected readonly requestForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, zodValidator(emailSchema)]
    })
  });

  protected readonly applyForm = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, zodValidator(passwordSchema)]
      }),
      passwordRepeat: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      })
    },
    { validators: passwordsMatch('password', 'passwordRepeat') }
  );

  protected readonly emailError = fieldError(
    this.requestForm.controls.email,
    'email'
  );
  protected readonly passwordError = fieldError(
    this.applyForm.controls.password,
    'password'
  );
  protected readonly passwordRepeatError = fieldError(
    this.applyForm.controls.passwordRepeat,
    'passwordRepeat'
  );

  protected readonly submitting = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);
  /** The mail has gone out, if there was an account to send it to. */
  protected readonly requested = signal(false);
  /** The token is spent or expired, so only a fresh link can help. */
  protected readonly tokenDead = signal(false);

  protected async requestLink(): Promise<void> {
    this.requestForm.markAllAsTouched();
    this.formError.set(null);
    const body = requestPasswordResetSchema.safeParse(
      this.requestForm.getRawValue()
    );
    if (!body.success || this.requestForm.invalid) return;

    this.submitting.set(true);
    try {
      await firstValueFrom(this.authApi.requestPasswordReset(body.data));
      this.requested.set(true);
    } catch (error) {
      this.formError.set(genericFailureKey(error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async applyNewPassword(): Promise<void> {
    this.applyForm.markAllAsTouched();
    this.formError.set(null);
    const body = confirmPasswordResetSchema.safeParse({
      token: this.token(),
      password: this.applyForm.getRawValue().password
    });
    if (!body.success || this.applyForm.invalid) return;

    this.submitting.set(true);
    try {
      await firstValueFrom(this.authApi.confirmPasswordReset(body.data));
      // A reset ends every session the old password opened, so there is nobody
      // to be signed in as: the page it lands on is the one that starts a new
      // one, and the toast is what says the change went through.
      this.toasts.add({
        severity: 'success',
        summary: this.translation.translate('pages.resetPassword.applied')
      });
      await this.router.navigateByUrl(this.links.login());
    } catch (error) {
      if (isApiError(error, 'token_invalid')) {
        this.formError.set('pages.resetPassword.tokenInvalid');
        this.tokenDead.set(true);
      } else {
        this.formError.set(genericFailureKey(error));
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
