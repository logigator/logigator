import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LgToggleSwitch } from '@logigator/ui';
import { ThemingService } from '../../theming/theming.service';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { AVAILABLE_LANGUAGES, LanguageId } from '../../translation/languages';
import { urlInLanguage } from '../../translation/language-url';
import { PreferencesService } from '../../storage/preferences.service';

/** Field of the origin-wide `preferences` cookie holding the language. */
const LANGUAGE_FIELD = 'lang';

/**
 * The language and theme controls, shared by the top bar's settings popover and
 * the compact navigation drawer — the same pair the legacy settings dropdown
 * and burger menu each rendered separately.
 *
 * Both write the origin-wide `preferences` cookie, so a choice made here is the
 * choice the editor opens with.
 */
@Component({
  selector: 'web-settings-panel',
  imports: [FormsModule, LgToggleSwitch, TranslateDirective],
  templateUrl: './settings-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPanel {
  private readonly location = inject(Location);
  private readonly preferences = inject(PreferencesService);
  protected readonly theming = inject(ThemingService);
  protected readonly activeLang = inject(TranslationService).getActiveLang();
  protected readonly languages = AVAILABLE_LANGUAGES;

  /**
   * The page currently open, in another language: a real link, so the four
   * translations are crawlable from each other and a middle-click behaves. The
   * switch is a document load by design — the language is in the URL, and a
   * server render is what puts the right one in the first byte.
   */
  protected languageHref(lang: LanguageId): string {
    return urlInLanguage(lang, this.location.path(true) || '/');
  }

  /**
   * Records the choice in the shared cookie, which is what carries it to the
   * editor and to the language the API writes mails in. The href performs the
   * switch itself; this is the preference behind it, and it is written before
   * the document load starts.
   */
  protected rememberLanguage(lang: LanguageId): void {
    this.preferences.set(LANGUAGE_FIELD, lang);
  }

  protected setDark(dark: boolean): void {
    this.theming.setTheme(dark ? 'dark' : 'light');
  }
}
