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
 * Field of the origin-wide `preferences` cookie holding the theme. The
 * surrounding pages use the same `light`/`dark` values, so a switch on either
 * side moves both.
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

  /** Every selectable theme. */
  public readonly availableThemes = Object.keys(THEMES) as ThemeType[];

  public setTheme(theme: ThemeType): void {
    this.applyTheme(theme);
    this.preferences.set(PREFERENCE_FIELD, theme);
  }

  /**
   * Applies the shared preference, or dark where there is none. Applying
   * without writing back keeps the editor from asserting a theme for the whole
   * origin when the user chose nothing; the server establishes the cookie on
   * the next page view, from the same default.
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
   * Sets the active theme type without {@link setTheme}'s DOM-class and cookie
   * side effects, for briefly switching theme to render an offscreen snapshot.
   * Always pair it with a synchronous restore.
   */
  public setActiveThemeType(type: ThemeType): void {
    this._currentThemeType.set(type);
  }
}
