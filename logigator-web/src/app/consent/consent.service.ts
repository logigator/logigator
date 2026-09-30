import { computed, inject, Injectable, signal } from '@angular/core';
import {
  CONSENT_COOKIE,
  ConsentCategory,
  consentCopy,
  decodeConsent,
  encodeConsent
} from '@logigator/core';
import {
  DialogService,
  LgConsentCopy,
  LgConsentPreferences
} from '@logigator/ui';
import { firstValueFrom } from 'rxjs';
import { SiteLinks } from '../layout/site-links';
import { CookieService } from '../storage/cookie.service';
import { TranslationService } from '../translation/translation.service';

/**
 * The visitor's answer to the consent question, in the origin-wide `consent`
 * cookie the editor reads and writes too — so a decision made on either side
 * is the one the other honours, and neither asks again.
 *
 * Read off the request during a server render, which is what puts the banner
 * in the first byte for a visitor who has not decided and leaves it out for one
 * who has.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly cookies = inject(CookieService);
  private readonly dialogs = inject(DialogService);
  private readonly links = inject(SiteLinks);
  private readonly translation = inject(TranslationService);

  /** The granted categories, or `null` while the visitor has not decided. */
  private readonly decision = signal(
    decodeConsent(this.cookies.get(CONSENT_COOKIE))
  );

  /** Whether the question is still open, which is when the banner shows. */
  public readonly pending = computed(() => this.decision() === null);

  /** The banner's and the dialog's words, in the document's language. */
  public readonly copy = computed<LgConsentCopy>(() =>
    consentCopy(
      (key) => this.translation.translate(`consent.${key}`),
      this.links.privacyPolicy()
    )
  );

  /** Whether a category is granted. Reactive when read in a reactive context. */
  public isGranted(category: ConsentCategory): boolean {
    return this.decision()?.includes(category) ?? false;
  }

  /** Records a decision; names that are not categories are dropped. */
  public decide(granted: readonly string[]): void {
    const value = encodeConsent(granted);
    this.cookies.set(CONSENT_COOKIE, value);
    this.decision.set(decodeConsent(value));
  }

  /** Asks category by category; dismissing the dialog changes nothing. */
  public async showPreferences(): Promise<void> {
    const copy = this.copy();
    const ref = this.dialogs.open(LgConsentPreferences, {
      header: copy.preferencesTitle,
      width: '36rem',
      closeLabel: this.translation.translate('common.close'),
      data: { copy, granted: this.decision() ?? [] }
    });
    const granted = await firstValueFrom(ref.onClose);
    if (granted) {
      this.decide(granted);
    }
  }
}
