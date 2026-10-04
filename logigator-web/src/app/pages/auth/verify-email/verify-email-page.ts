import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '@logigator/contract';
import { LgButton, LgMessage } from '@logigator/ui';
import { AuthApiService } from '../../../api/services/auth-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { SiteLinks } from '../../../layout/site-links';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SessionService } from '../../../user/session.service';
import { AuthShell } from '../auth-shell';

type VerificationState = 'pending' | 'confirmed' | 'failed';

/**
 * Where a confirmation mail's link lands. The token is one-shot, so redeeming
 * it is deliberately a browser-only act: a server render happens for every
 * crawler and every mail client that fetches a link to preview it, and any one
 * of those would burn the token before the recipient ever clicked. The render
 * therefore emits the pending state and nothing else.
 *
 * Confirming an address change signs in nobody and changes nothing about the
 * current session, so the account the shell shows is re-read rather than
 * assumed — the address on it is the thing that just moved.
 */
@Component({
  selector: 'web-verify-email-page',
  imports: [AuthShell, LgButton, LgMessage, RouterLink, TranslateDirective],
  templateUrl: './verify-email-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyEmailPage {
  private readonly authApi = inject(AuthApiService);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);

  protected readonly links = inject(SiteLinks);

  protected readonly state = signal<VerificationState>('pending');
  protected readonly failure = signal<TranslationKey>(
    'pages.verifyEmail.errorLead'
  );

  constructor() {
    afterNextRender(() => void this.verify());
  }

  private async verify(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.state.set('failed');
      return;
    }

    try {
      await firstValueFrom(this.authApi.verifyEmail({ token }));
      this.state.set('confirmed');
      // A signed-in visitor confirming a new address is looking at the old one
      // in the bar; the session itself is untouched, so only the account has to
      // be read again.
      if (this.session.user()) await this.session.resolve();
    } catch (error) {
      this.failure.set(
        isApiError(error, 'token_invalid')
          ? 'pages.verifyEmail.errorLead'
          : genericFailureKey(error)
      );
      this.state.set('failed');
    }
  }
}
