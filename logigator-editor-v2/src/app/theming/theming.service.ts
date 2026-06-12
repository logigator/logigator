import { computed, Injectable, signal } from '@angular/core';
import { Theme } from './theme.model';
import { ThemeType } from './theme-type.enum';
import { LightTheme } from './themes/light.theme';
import { DarkTheme } from './themes/dark.theme';

const THEMES: Record<ThemeType, Theme> = {
  [ThemeType.LIGHT]: LightTheme,
  [ThemeType.DARK]: DarkTheme
};

const STORAGE_KEY = 'logigator.theme';

@Injectable({
  providedIn: 'root'
})
export class ThemingService {
  private readonly _currentThemeType = signal<ThemeType>(ThemeType.DARK);
  public readonly currentThemeType = computed(() => this._currentThemeType());
  public readonly currentTheme = computed(
    () => THEMES[this._currentThemeType()]
  );

  constructor() {
    this.loadTheme();
  }

  public setTheme(theme: ThemeType): void {
    this._currentThemeType.set(theme);
    document.documentElement.classList.toggle(
      'dark-mode',
      theme === ThemeType.DARK
    );
    localStorage.setItem(STORAGE_KEY, String(theme));
  }

  public loadTheme(): void {
    const theme = localStorage.getItem(STORAGE_KEY) as ThemeType | null;
    this.setTheme(theme && THEMES[theme] ? theme : ThemeType.DARK);
  }
}
