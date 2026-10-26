import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiRequestError } from '@logigator/contract';
import { RETURN_PATH_PARAM } from '@logigator/core';
import {
  ConfirmationService,
  LgButton,
  LgFormField,
  LgInputText,
  LgMessage,
  ToastService
} from '@logigator/ui';
import { environment } from '../../../../environments/environment';
import { UserApiService } from '../../../api/services/user-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { fieldError, setServerError } from '../../../forms/field-error';
import { SiteLinks } from '../../../layout/site-links';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslationService } from '../../../translation/translation.service';
import { googleErrorKey } from '../../../user/google-auth-errors';
import { SessionService } from '../../../user/session.service';
import { AccountSection } from './account-section';

/**
 * Marks the account page a Google round trip returns to when it was started to
 * finish a deletion.
 */
export const RESUME_DELETE_PARAM = 'resume';
const RESUME_DELETE_VALUE = 'delete';

/**
 * Deleting the account, and with it every project, component and star it owns
 * — one cascade, so nothing is left half-deleted and nothing here is
 * recoverable afterwards.
 *
 * It asks twice: for the password, because a session alone is proof of intent
 * for nothing that moves control of an account, and then in words, because the
 * password is muscle memory and the confirmation is what makes the reader
 * read. An account with no password signs in with Google again instead, when
 * its session is older than the API accepts, and comes back here to confirm.
 */
@Component({
  selector: 'web-account-delete-section',
  imports: [
    AccountSection,
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    ReactiveFormsModule,
    TranslateDirective
  ],
  templateUrl: './account-delete-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountDeleteSection {
  private readonly userApi = inject(UserApiService);
  private readonly session = inject(SessionService);
  private readonly confirmations = inject(ConfirmationService);
  private readonly toasts = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly links = inject(SiteLinks);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly needsPassword = computed(
    () => this.session.user()?.hasPassword ?? false
  );

  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly passwordError = fieldError(this.password, 'password');

  protected readonly deleting = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);
  protected readonly reauthenticate = signal(false);

  /** The API's Google start route, returning to this page marked to resume. */
  protected readonly reauthenticateUrl = computed(() => {
    const destination = this.router.parseUrl(this.router.url);
    destination.queryParams = { [RESUME_DELETE_PARAM]: RESUME_DELETE_VALUE };
    destination.fragment = null;
    const returnPath = encodeURIComponent(
      this.router.serializeUrl(destination)
    );
    return `${environment.apiUrl}/api/auth/google?${RETURN_PATH_PARAM}=${returnPath}`;
  });

  constructor() {
    afterNextRender(() => void this.resume());
  }

  /**
   * Back from the round trip: the marker and any failure leave the URL, so a
   * reload does not ask again, and a successful sign-in opens the
   * confirmation the member was on.
   */
  private async resume(): Promise<void> {
    const query = this.route.snapshot.queryParamMap;
    if (query.get(RESUME_DELETE_PARAM) !== RESUME_DELETE_VALUE) return;

    const failure = googleErrorKey(query.get('error'));
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [RESUME_DELETE_PARAM]: null, error: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    if (failure) {
      this.formError.set(failure);
      this.reauthenticate.set(true);
    } else {
      this.confirm();
    }
  }

  protected confirm(): void {
    this.formError.set(null);
    this.reauthenticate.set(false);
    this.password.markAsTouched();
    if (this.needsPassword() && !this.password.value) {
      this.password.setErrors({ required: true });
      return;
    }
    if (this.deleting()) return;

    this.confirmations.confirm({
      header: this.translation.translate('pages.my.account.delete.heading'),
      message: this.translation.translate('pages.my.account.delete.confirm'),
      acceptLabel: this.translation.translate('pages.my.account.delete.submit'),
      rejectLabel: this.translation.translate('pages.my.delete.cancel'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => void this.deleteAccount()
    });
  }

  private async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    try {
      await firstValueFrom(
        this.userApi.deleteAccount(
          this.needsPassword() ? { password: this.password.value } : {}
        )
      );
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'invalid_credentials'
      ) {
        setServerError(this.password, 'pages.my.account.passwordIncorrect');
      } else if (
        error instanceof ApiRequestError &&
        error.code === 'reauthentication_required'
      ) {
        this.reauthenticate.set(true);
      } else {
        this.formError.set(genericFailureKey(error));
      }
      return;
    } finally {
      this.deleting.set(false);
    }

    // The session went with the account, so there is nothing left to sign out
    // of — and the page this is on is behind the guard that would send an
    // anonymous visitor to the sign-in form.
    this.session.signedOut();
    this.toasts.add({
      severity: 'success',
      summary: this.translation.translate('pages.my.account.delete.done')
    });
    await this.router.navigateByUrl(this.links.home());
  }
}
