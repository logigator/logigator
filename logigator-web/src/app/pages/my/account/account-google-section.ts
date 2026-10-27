import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  signal
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiRequestError } from '@logigator/contract';
import { RETURN_PATH_PARAM } from '@logigator/core';
import {
  ConfirmationService,
  LgButton,
  LgFormField,
  LgInputText,
  LgMessage
} from '@logigator/ui';
import { environment } from '../../../../environments/environment';
import { AuthApiService } from '../../../api/services/auth-api.service';
import { UserApiService } from '../../../api/services/user-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { fieldError, setServerError } from '../../../forms/field-error';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslationService } from '../../../translation/translation.service';
import { AuthProvidersService } from '../../../user/auth-providers.service';
import { googleErrorKey } from '../../../user/google-auth-errors';
import { SessionService } from '../../../user/session.service';
import { RESUME_PARAM } from './account-reauthentication';
import { AccountSection } from './account-section';
import { AccountUsername } from './account-username';

/** What the API answers a link started from a session older than it accepts. */
const REAUTHENTICATION_REQUIRED = 'google_reauthentication_required';

/**
 * Google as a way into this account.
 *
 * Linking is the same OAuth round trip a sign-in is — the API records that the
 * caller was already signed in and links rather than signs in — so the control
 * is a plain link out of the app, carrying this page as the destination the
 * flow record holds. The API starts a link only from a recent sign-in, since
 * the redirect cannot carry a password; an older session comes back refused,
 * and the member signs in again here with the password before going on to
 * Google. Unlinking is an ordinary call that takes the password, and the API
 * refuses it while the account has none: Google would be the only way back in.
 *
 * The section is drawn only where the deployment offers Google at all, which
 * is what `GET /meta` reports and the sign-in pages already read.
 *
 * A failed link comes back as a `?error=` on this page's own URL: the API
 * answers every failed round trip on the configured sign-in URL, and
 * `guestGuard` — which a visitor who still has a session always trips there —
 * forwards it to where the flow started.
 */
@Component({
  selector: 'web-account-google-section',
  imports: [
    AccountSection,
    AccountUsername,
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    ReactiveFormsModule,
    TranslateDirective
  ],
  // A deployment without Google credentials draws nothing, and a zero-height
  // flex item still takes the stack's gap. `:empty` ignores Angular's own
  // container comments, so an unrendered `@if` leaves the host genuinely empty.
  host: { class: 'block empty:hidden' },
  templateUrl: './account-google-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountGoogleSection {
  private readonly userApi = inject(UserApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly session = inject(SessionService);
  private readonly confirmations = inject(ConfirmationService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly providers = inject(AuthProvidersService);

  protected readonly linked = computed(
    () => this.session.user()?.googleLinked ?? false
  );

  /** Unlinking is refused while Google is the only way in, so the control says
   * so rather than offering a button the API answers `409` to. */
  protected readonly canUnlink = computed(
    () => this.session.user()?.hasPassword ?? false
  );

  /** A link the API refused for the session's age, to be retried after
   * signing in again with the password. */
  protected readonly signInAgain = computed(
    () =>
      !this.linked() && this.query()?.get('error') === REAUTHENTICATION_REQUIRED
  );

  /** Unlinking and signing in again to link are the two steps that take the
   * password; one of them at a time is on offer. */
  protected readonly needsPassword = computed(
    () => (this.linked() && this.canUnlink()) || this.signInAgain()
  );

  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly form = new FormGroup({ password: this.password });
  protected readonly passwordError = fieldError(this.password, 'password');

  protected readonly working = signal(false);
  private readonly actionFailure = signal<TranslationKey | null>(null);

  /**
   * Why the last attempt failed — an action here, or a link that came back
   * through the API's callback. A failed round trip is answered on the
   * configured sign-in URL, and `guestGuard` sends a visitor who still has a
   * session on to where the flow started, carrying the `?error=` with it.
   */
  protected readonly failureKey = computed(() => {
    const query = this.query();
    const code = query?.get('error') ?? null;
    // A round trip to finish another section's change reports its failure
    // there, and a refusal for the session's age is answered by signing in.
    if (query?.has(RESUME_PARAM) || code === REAUTHENTICATION_REQUIRED) {
      return this.actionFailure();
    }
    return this.actionFailure() ?? googleErrorKey(code);
  });

  /**
   * The API's own start route, on the API's origin — a full document load, not
   * a router navigation: the round trip leaves this app entirely and comes back
   * to the path named here, without the outcome of an earlier one.
   */
  protected readonly linkUrl = computed(() => {
    const destination = this.router.parseUrl(this.router.url);
    destination.queryParams = { ...destination.queryParams };
    delete destination.queryParams['error'];
    const returnPath = encodeURIComponent(
      this.router.serializeUrl(destination)
    );
    return `${environment.apiUrl}/api/auth/google?${RETURN_PATH_PARAM}=${returnPath}`;
  });

  /** Signs in again with the password, which makes the session recent enough
   * to start a link, and goes on to Google. */
  private async signInAgainAndLink(): Promise<void> {
    const email = this.session.user()?.email;
    if (!this.passwordGiven() || !email || this.working()) return;

    this.working.set(true);
    this.actionFailure.set(null);
    try {
      this.session.signedIn(
        await firstValueFrom(
          this.authApi.login({ email, password: this.password.value })
        )
      );
    } catch (error) {
      this.reportFailure(error);
      this.working.set(false);
      return;
    }
    this.document.location.assign(this.linkUrl());
  }

  protected submitPassword(): void {
    if (this.linked()) this.confirmUnlink();
    else void this.signInAgainAndLink();
  }

  private confirmUnlink(): void {
    if (!this.passwordGiven()) return;

    this.confirmations.confirm({
      header: this.translation.translate('pages.my.account.google.unlink'),
      message: this.translation.translate(
        'pages.my.account.google.unlinkConfirm'
      ),
      acceptLabel: this.translation.translate('pages.my.account.google.unlink'),
      rejectLabel: this.translation.translate('pages.my.delete.cancel'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => void this.unlink()
    });
  }

  private passwordGiven(): boolean {
    this.password.markAsTouched();
    if (this.password.value) return true;
    this.password.setErrors({ required: true });
    return false;
  }

  private async unlink(): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    this.actionFailure.set(null);
    try {
      this.session.updated(
        await firstValueFrom(
          this.userApi.unlinkGoogle({ password: this.password.value })
        )
      );
      this.password.reset();
    } catch (error) {
      this.reportFailure(error);
    } finally {
      this.working.set(false);
    }
  }

  private reportFailure(error: unknown): void {
    if (
      error instanceof ApiRequestError &&
      error.code === 'invalid_credentials'
    ) {
      setServerError(this.password, 'pages.my.account.passwordIncorrect');
    } else if (error instanceof ApiRequestError && error.code === 'conflict') {
      this.actionFailure.set('pages.my.account.google.needsPassword');
    } else {
      this.actionFailure.set(genericFailureKey(error));
    }
  }
}
