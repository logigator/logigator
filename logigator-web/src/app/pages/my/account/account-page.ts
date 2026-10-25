import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationService } from '../../../translation/translation.service';
import { SessionService } from '../../../user/session.service';
import { AccountDeleteSection } from './account-delete-section';
import { AccountEmailSection } from './account-email-section';
import { AccountGoogleSection } from './account-google-section';
import { AccountPasswordSection } from './account-password-section';
import { AccountProfileSection } from './account-profile-section';

/**
 * The account, as one page of stacked sections rather than a route each.
 *
 * `authGuard` answers a `302` for a visitor with no session, so nothing here is
 * indexable and the crawler argument that split a public profile into four
 * routes does not apply. Each section is an independent form against
 * `PATCH /user`, and each reads the account out of {@link SessionService},
 * which every write puts its answer back into — so a changed username reaches
 * the bar above without a re-read.
 */
@Component({
  selector: 'web-account-page',
  imports: [
    AccountDeleteSection,
    AccountEmailSection,
    AccountGoogleSection,
    AccountPasswordSection,
    AccountProfileSection,
    TranslateDirective
  ],
  templateUrl: './account-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountPage {
  private readonly translation = inject(TranslationService);

  protected readonly session = inject(SessionService);

  /** A calendar date in UTC, the way every other date on the site is written:
   * a zone west of midnight names the day before. */
  protected readonly memberSince = computed(() => {
    const since = this.session.user()?.memberSince;
    return since
      ? new Intl.DateTimeFormat(this.translation.activeLang(), {
          dateStyle: 'long',
          timeZone: 'UTC'
        }).format(new Date(since))
      : '';
  });
}
