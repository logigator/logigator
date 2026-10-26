import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
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
import { ApiRequestError, passwordSchema } from '@logigator/contract';
import { LgButton, LgFormField, LgInputText, LgMessage } from '@logigator/ui';
import { UserApiService } from '../../../api/services/user-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import {
  fieldError,
  passwordsMatch,
  setServerError
} from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SessionService } from '../../../user/session.service';
import {
  AccountReauthentication,
  googleReauthentication
} from './account-reauthentication';
import { AccountSection } from './account-section';

/**
 * Setting or changing the account's password.
 *
 * An account that has one must present it, for the reason a change of address
 * must. An account signed up through Google has none, so this is where it gets
 * its first — which is also what makes unlinking Google possible, that being
 * refused while Google is the only way back in. It needs a recent sign-in for
 * that, and comes back here from signing in with Google again to type it; the
 * new password is never kept across the round trip.
 *
 * A change ends every other session the old password opened, sparing this one.
 * Nothing here has to act on that: the API spares the caller's session, and the
 * page the reader is on stays signed in.
 */
@Component({
  selector: 'web-account-password-section',
  imports: [
    AccountReauthentication,
    AccountSection,
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    ReactiveFormsModule,
    TranslateDirective
  ],
  templateUrl: './account-password-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountPasswordSection {
  private readonly userApi = inject(UserApiService);
  private readonly session = inject(SessionService);
  private readonly document = inject(DOCUMENT);

  /** False for an account that arrived through Google and has never set one. */
  protected readonly hasPassword = computed(
    () => this.session.user()?.hasPassword ?? false
  );

  protected readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', { nonNullable: true }),
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

  protected readonly currentError = fieldError(
    this.form.controls.currentPassword,
    'password'
  );
  protected readonly passwordError = fieldError(
    this.form.controls.password,
    'password'
  );
  protected readonly repeatError = fieldError(
    this.form.controls.passwordRepeat,
    'passwordRepeat'
  );

  protected readonly submitting = signal(false);
  protected readonly saved = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);

  protected readonly reauthentication = googleReauthentication('password', {
    onReturn: ({ failure }) => {
      if (failure) this.formError.set(failure);
      else this.document.getElementById('account-new-password')?.focus();
    }
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.saved.set(false);
    this.reauthentication.dismiss();

    const currentPassword = this.form.controls.currentPassword.value;
    if (this.hasPassword() && !currentPassword) {
      this.form.controls.currentPassword.setErrors({ required: true });
    }
    const password = passwordSchema.safeParse(
      this.form.controls.password.value
    );
    if (!password.success || this.form.invalid) return;

    this.submitting.set(true);
    try {
      const result = await firstValueFrom(
        this.userApi.update({
          password: password.data,
          ...(this.hasPassword() ? { currentPassword } : {})
        })
      );
      // `hasPassword` flips for an account that had none, which is what turns
      // the Google section's unlink control on.
      this.session.updated(result.user);
      this.form.reset();
      this.saved.set(true);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'invalid_credentials'
      ) {
        setServerError(
          this.form.controls.currentPassword,
          'pages.my.account.passwordIncorrect'
        );
      } else if (
        error instanceof ApiRequestError &&
        error.code === 'reauthentication_required'
      ) {
        this.reauthentication.require();
      } else {
        this.formError.set(genericFailureKey(error));
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
