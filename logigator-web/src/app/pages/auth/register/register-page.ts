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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ApiRequestError,
  emailSchema,
  passwordSchema,
  registerRequestSchema,
  usernameSchema
} from '@logigator/contract';
import { RETURN_PATH_PARAM, safeReturnPath } from '@logigator/core';
import { LgButton, LgFormField, LgInputText, LgMessage } from '@logigator/ui';
import { AuthApiService } from '../../../api/services/auth-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import {
  applyServerFieldErrors,
  fieldError,
  passwordsMatch,
  setServerError
} from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { SiteLinks } from '../../../layout/site-links';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { AuthShell } from '../auth-shell';
import { GoogleSignIn } from '../google-sign-in';

/**
 * Creating an account. The API mails a confirmation link and refuses sign-in
 * until it is opened, so the page ends on an inbox instruction rather than on a
 * session — which is also why the repeated password lives here and not in the
 * contract: it guards a typo the visitor cannot discover later, and the server
 * has nothing to check it against.
 */
@Component({
  selector: 'web-register-page',
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
  templateUrl: './register-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPage {
  private readonly authApi = inject(AuthApiService);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly links = inject(SiteLinks);

  protected readonly form = new FormGroup(
    {
      username: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, zodValidator(usernameSchema)]
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, zodValidator(emailSchema)]
      }),
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

  protected readonly usernameError = fieldError(
    this.form.controls.username,
    'username'
  );
  protected readonly emailError = fieldError(this.form.controls.email, 'email');
  protected readonly passwordError = fieldError(
    this.form.controls.password,
    'password'
  );
  protected readonly passwordRepeatError = fieldError(
    this.form.controls.passwordRepeat,
    'passwordRepeat'
  );

  protected readonly submitting = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);
  /** The address the confirmation link went to, once the account exists. */
  protected readonly awaitingConfirmation = signal<string | null>(null);

  /** Carried on to the sign-in link, so a return trip survives the detour. */
  protected readonly returnPath = computed(() =>
    safeReturnPath(this.query()?.get(RETURN_PATH_PARAM))
  );

  /**
   * Passed to `routerLink` beside the login path rather than baked into it: a
   * link string carrying a query is one command segment to the router, which
   * would encode the `?` into the path.
   */
  protected readonly loginQuery = computed(() => {
    const destination = this.returnPath();
    return destination ? { [RETURN_PATH_PARAM]: destination } : {};
  });

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    const body = registerRequestSchema.safeParse(this.form.getRawValue());
    if (!body.success || this.form.invalid) return;

    this.submitting.set(true);
    try {
      await firstValueFrom(this.authApi.register(body.data));
      this.awaitingConfirmation.set(body.data.email);
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
      case 'conflict':
        // The one failure the form can act on, and it belongs beside the field
        // it is about — registration says an address is taken plainly, so that
        // the page can offer signing in instead.
        setServerError(this.form.controls.email, 'pages.register.emailTaken');
        return;
      case 'service_unavailable':
        // The account exists; only the mail did not go out, and asking for it
        // again is what the login page's resend is for.
        this.formError.set('pages.register.mailFailed');
        return;
      case 'validation_failed':
        applyServerFieldErrors(this.form, error.details);
        break;
    }
    this.formError.set(genericFailureKey(error));
  }
}
