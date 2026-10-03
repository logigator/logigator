import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiRequestError, emailSchema } from '@logigator/contract';
import { LgButton, LgFormField, LgInputText, LgMessage } from '@logigator/ui';
import { UserApiService } from '../../../api/services/user-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { fieldError, setServerError } from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SessionService } from '../../../user/session.service';
import { AccountSection } from './account-section';

/**
 * Changing the address the account signs in with.
 *
 * Gated on the current password exactly as a password change is: the two
 * together are a complete takeover — a stolen session cookie points the address
 * at a mailbox the thief owns, confirms it from there, and then resets the
 * password with a link the owner never sees. An account with no password has
 * nothing to prove with, so the field is not shown for one.
 *
 * The change does not land here. The API mails the *new* address a
 * confirmation and keeps the old one until that link is opened, so a typo
 * expires instead of locking its owner out — which is why the section stays on
 * the address the account still has, and says which one is waiting.
 */
@Component({
  selector: 'web-account-email-section',
  imports: [
    AccountSection,
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    ReactiveFormsModule,
    TranslateDirective
  ],
  templateUrl: './account-email-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountEmailSection {
  private readonly userApi = inject(UserApiService);
  private readonly session = inject(SessionService);

  protected readonly user = this.session.user;

  /** An account signed up through Google has no password to prove with. */
  protected readonly needsPassword = computed(
    () => this.user()?.hasPassword ?? false
  );

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, zodValidator(emailSchema)]
    }),
    currentPassword: new FormControl('', { nonNullable: true })
  });

  protected readonly emailError = fieldError(this.form.controls.email, 'email');
  protected readonly passwordError = fieldError(
    this.form.controls.currentPassword,
    'password'
  );

  protected readonly submitting = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);
  /** The address a confirmation link went to, once one is on its way. */
  protected readonly awaitingConfirmation = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.awaitingConfirmation.set(null);

    const email = emailSchema.safeParse(this.form.controls.email.value);
    const currentPassword = this.form.controls.currentPassword.value;
    if (this.needsPassword() && !currentPassword) {
      this.form.controls.currentPassword.setErrors({ required: true });
    }
    if (!email.success || this.form.invalid) return;

    this.submitting.set(true);
    try {
      const result = await firstValueFrom(
        this.userApi.update({
          email: email.data,
          ...(this.needsPassword() ? { currentPassword } : {})
        })
      );
      // The account still carries the old address; only the mail has moved.
      this.session.updated(result.user);
      if (result.emailVerificationSent) {
        this.awaitingConfirmation.set(email.data);
        this.form.reset();
      } else {
        // What the API answers for an address the account already has. The
        // form keeps what was typed: there is a correction to make in it.
        this.formError.set('pages.my.account.email.unchanged');
      }
    } catch (error) {
      this.reportFailure(error);
    } finally {
      this.submitting.set(false);
    }
  }

  private reportFailure(error: unknown): void {
    if (!(error instanceof ApiRequestError)) {
      this.formError.set(genericFailureKey(error));
      return;
    }

    switch (error.code) {
      case 'invalid_credentials':
        setServerError(
          this.form.controls.currentPassword,
          'pages.my.account.passwordIncorrect'
        );
        return;
      case 'conflict':
        setServerError(
          this.form.controls.email,
          'pages.my.account.email.taken'
        );
        return;
      case 'service_unavailable':
        // Nothing has moved — the address lives on the token, which was never
        // issued — so this is a retry rather than a half-finished change.
        this.formError.set('pages.my.account.email.mailFailed');
        return;
      default:
        this.formError.set(genericFailureKey(error));
    }
  }
}
