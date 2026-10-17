import { computed, inject, Injectable } from '@angular/core';
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
import { CookieService } from '../storage/cookie.service';
import { TranslationService } from '../translation/translation.service';

/**
 * The visitor's answer to the consent question, in the origin-wide `consent`
 * cookie the website reads and writes too — so a decision made on either side
 * is the one the other honours, and neither asks again. Derived from the
 * reactive cookie map, so an answer given in another tab closes the banner
 * here as well.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly cookies = inject(CookieService);
  private readonly dialogs = inject(DialogService);
  private readonly translation = inject(TranslationService);

  /** The granted categories, or `null` while the visitor has not decided. */
  private readonly decision = computed(() =>
    decodeConsent(this.cookies.get(CONSENT_COOKIE))
  );

  /** Whether the question is still open, which is when the banner shows. */
  public readonly pending = computed(() => this.decision() === null);

  /** The banner's and the dialog's words, in the active language. */
  public readonly copy = computed<LgConsentCopy>(() =>
    consentCopy(
      (key) => this.translation.translate(`consent.${key}`),
      // Unprefixed: the website picks the language from the `preferences`
      // cookie, which already holds the editor's.
      '/privacy-policy'
    )
  );

  /** Whether a category is granted. Reactive when read in a reactive context. */
  public isGranted(category: ConsentCategory): boolean {
    return this.decision()?.includes(category) ?? false;
  }

  /** Records a decision; names that are not categories are dropped. */
  public decide(granted: readonly string[]): void {
    this.cookies.set(CONSENT_COOKIE, encodeConsent(granted));
  }

  /** Asks category by category; dismissing the dialog changes nothing. */
  public async showPreferences(): Promise<void> {
    const copy = this.copy();
    const ref = this.dialogs.open(LgConsentPreferences, {
      header: copy.preferencesTitle,
      width: '36rem',
      modal: true,
      closable: true,
      data: { copy, granted: this.decision() ?? [] }
    });
    const granted = await firstValueFrom(ref.onClose);
    if (granted) {
      this.decide(granted);
    }
  }
}
