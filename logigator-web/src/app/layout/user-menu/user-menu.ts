import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { DOCUMENT, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LgSelect,
  LgSelectButton,
  LgUserControl,
  LgUserPanelSection,
  type MenuItem
} from '@logigator/ui';
import { AVAILABLE_LANGUAGES, LanguageId } from '@logigator/core';
import { SessionService } from '../../user/session.service';
import { SiteLinks } from '../site-links';
import { ThemingService } from '../../theming/theming.service';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { urlInLanguage } from '../../translation/language-url';
import { PreferencesService } from '../../storage/preferences.service';

/** Field of the origin-wide `preferences` cookie holding the language. */
const LANGUAGE_FIELD = 'lang';

/**
 * The bar's account control: the shared trigger and panel from
 * `@logigator/ui`, filled with the site's settings sections and account rows.
 * It is the site's only settings surface, at every width — which is why the bar
 * carries no gear and no auth buttons.
 *
 * Two sections rather than the editor's three — there are no editor settings
 * here — and both are the editor's own controls, so the two panels read alike.
 * A language switch is still a document load; the select performs it rather
 * than swapping a table in place, and the four translations stay discoverable
 * through the `hreflang` alternates `SeoService` emits.
 */
@Component({
  selector: 'web-user-menu',
  imports: [
    FormsModule,
    LgSelect,
    LgSelectButton,
    LgUserControl,
    LgUserPanelSection,
    TranslateDirective
  ],
  templateUrl: './user-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserMenu {
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly preferences = inject(PreferencesService);
  private readonly translation = inject(TranslationService);
  private readonly links = inject(SiteLinks);

  protected readonly session = inject(SessionService);
  protected readonly theming = inject(ThemingService);
  protected readonly languages = AVAILABLE_LANGUAGES;
  protected readonly activeLang = this.translation.getActiveLang();

  /**
   * The avatar ladder the API encoded, untouched: the browser picks the width
   * for its pixel ratio and the first encoding it can decode. An account with
   * no avatar falls back to the username's initial.
   */
  protected readonly avatar = computed(() => {
    const variants = this.session.user()?.avatar;
    return variants?.length ? variants : undefined;
  });

  protected readonly themeOptions = computed(() => [
    {
      label: this.translation.translate('header.themeLight'),
      icon: 'ph ph-sun',
      value: 'light' as const
    },
    {
      label: this.translation.translate('header.themeDark'),
      icon: 'ph ph-moon',
      value: 'dark' as const
    }
  ]);

  /**
   * The account rows. Commands rather than links, because the panel comes from
   * a library that may not import the router; the destinations a visitor should
   * be able to open in a tab of its own are in the bar and the drawer.
   */
  protected readonly rows = computed<MenuItem[]>(() =>
    this.session.user() ? this.signedInRows() : this.signedOutRows()
  );

  /**
   * Leaves for the page currently open, in another language.
   *
   * The preference goes into the shared cookie first — that is what carries the
   * choice to the editor and to the language the API writes mails in — and the
   * document load follows, since the language is a URL segment and a server
   * render is what puts the right one in the first byte.
   */
  protected switchLanguage(lang: LanguageId): void {
    if (lang === this.activeLang) {
      return;
    }
    this.preferences.set(LANGUAGE_FIELD, lang);
    this.document.location.assign(
      urlInLanguage(lang, this.location.path(true) || '/')
    );
  }

  private signedInRows(): MenuItem[] {
    return [
      {
        label: this.translation.translate('header.account'),
        icon: 'ph ph-user',
        command: () => void this.router.navigateByUrl(this.links.account)
      },
      {
        label: this.translation.translate('header.logout'),
        icon: 'ph ph-sign-out',
        command: () => this.logout()
      }
    ];
  }

  private signedOutRows(): MenuItem[] {
    return [
      {
        label: this.translation.translate('header.login'),
        icon: 'ph ph-sign-in',
        command: () => void this.router.navigateByUrl(this.links.login)
      },
      {
        label: this.translation.translate('header.register'),
        icon: 'ph ph-user-plus',
        command: () => void this.router.navigateByUrl(this.links.register)
      }
    ];
  }

  private logout(): void {
    // The signed-out bar is the only feedback needed, and the API answers 204
    // whether or not there was a session, so a failure here means the request
    // never landed and the session the bar shows is still real.
    void this.session.logout().catch(() => undefined);
  }
}
