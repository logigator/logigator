import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiRequestError } from '@logigator/contract';
import { RETURN_PATH_PARAM } from '@logigator/core';
import { ConfirmationService, LgButton, LgMessage } from '@logigator/ui';
import { environment } from '../../../../environments/environment';
import { UserApiService } from '../../../api/services/user-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslationService } from '../../../translation/translation.service';
import { AuthProvidersService } from '../../../user/auth-providers.service';
import { googleErrorKey } from '../../../user/google-auth-errors';
import { SessionService } from '../../../user/session.service';
import { AccountSection } from './account-section';

/**
 * Google as a way into this account.
 *
 * Linking is the same OAuth round trip a sign-in is — the API records that the
 * caller was already signed in and links rather than signs in — so the control
 * is a plain link out of the app, carrying this page as the destination the
 * flow record holds. Unlinking is an ordinary call, and the API refuses it
 * while the account has no password: Google would be the only way back in.
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
  imports: [AccountSection, LgButton, LgMessage, TranslateDirective],
  // A deployment without Google credentials draws nothing, and a zero-height
  // flex item still takes the stack's gap. `:empty` ignores Angular's own
  // container comments, so an unrendered `@if` leaves the host genuinely empty.
  host: { class: 'block empty:hidden' },
  templateUrl: './account-google-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountGoogleSection {
  private readonly userApi = inject(UserApiService);
  private readonly session = inject(SessionService);
  private readonly confirmations = inject(ConfirmationService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);
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

  protected readonly working = signal(false);
  private readonly unlinkFailure = signal<TranslationKey | null>(null);

  /**
   * Why the last attempt failed — an unlink here, or a link that came back
   * through the API's callback. A failed round trip is answered on the
   * configured sign-in URL, and `guestGuard` sends a visitor who still has a
   * session on to where the flow started, carrying the `?error=` with it.
   */
  protected readonly failureKey = computed(
    () =>
      this.unlinkFailure() ?? googleErrorKey(this.query()?.get('error') ?? null)
  );

  /**
   * The API's own start route, on the API's origin — a full document load, not
   * a router navigation: the round trip leaves this app entirely and comes back
   * to the path named here.
   */
  protected readonly linkUrl = computed(() => {
    const destination = encodeURIComponent(this.router.url);
    return `${environment.apiUrl}/api/auth/google?${RETURN_PATH_PARAM}=${destination}`;
  });

  protected confirmUnlink(): void {
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

  private async unlink(): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    this.unlinkFailure.set(null);
    try {
      this.session.updated(await firstValueFrom(this.userApi.unlinkGoogle()));
    } catch (error) {
      this.unlinkFailure.set(
        error instanceof ApiRequestError && error.code === 'conflict'
          ? 'pages.my.account.google.needsPassword'
          : genericFailureKey(error)
      );
    } finally {
      this.working.set(false);
    }
  }
}
