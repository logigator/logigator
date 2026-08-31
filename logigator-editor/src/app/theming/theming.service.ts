import { computed, inject, Injectable, signal } from '@angular/core';
import { Theme } from './theme.model';
import { ThemeType } from './theme-type.enum';
import { LightTheme } from './themes/light.theme';
import { DarkTheme } from './themes/dark.theme';
import { PreferencesService } from '../storage/preferences.service';

const THEMES: Record<ThemeType, Theme> = {
  [ThemeType.LIGHT]: LightTheme,
  [ThemeType.DARK]: DarkTheme
};

/**
 * Field of the origin-wide `preferences` cookie holding the theme, shared with
 * the pages the editor is served alongside — the editor's `light`/`dark` are the
 * values they use as well, so switching theme on either side moves both.
 */
const PREFERENCE_FIELD = 'theme';

@Injectable({
  providedIn: 'root'
})
export class ThemingService {
  private readonly preferences = inject(PreferencesService);

  private readonly _currentThemeType = signal<ThemeType>(ThemeType.DARK);
  public readonly currentThemeType = computed(() => this._currentThemeType());
  public readonly currentTheme = computed(
    () => THEMES[this._currentThemeType()]
  );

  constructor() {
    this.loadTheme();
  }

  /** Every selectable theme — the keys of the theme table itself. */
  public readonly availableThemes = Object.keys(THEMES) as ThemeType[];

  public setTheme(theme: ThemeType): void {
    this.applyTheme(theme);
    this.preferences.set(PREFERENCE_FIELD, theme);
  }

  /**
   * Applies the shared preference, or dark for a user who has no theme yet.
   * Applying without writing back keeps the editor from asserting a theme for the
   * whole origin on a load where the user chose nothing: the server establishes
   * the cookie on the next page view, from the same default.
   */
  public loadTheme(): void {
    const theme = this.preferences.get(PREFERENCE_FIELD) as ThemeType | null;
    this.applyTheme(theme && THEMES[theme] ? theme : ThemeType.DARK);
  }

  private applyTheme(theme: ThemeType): void {
    this._currentThemeType.set(theme);
    document.documentElement.classList.toggle(
      'dark-mode',
      theme === ThemeType.DARK
    );
  }

  /**
   * Sets the active theme type without the DOM-class / localStorage side
   * effects of {@link setTheme}. Intended for briefly switching theme to render
   * an offscreen snapshot (dual-theme previews); always pair it with a
   * synchronous restore.
   */
  public setActiveThemeType(type: ThemeType): void {
    this._currentThemeType.set(type);
  }
}
