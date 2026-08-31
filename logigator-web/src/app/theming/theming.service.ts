import { computed, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PreferencesService } from '../storage/preferences.service';
import { DARK_THEME_CLASS, DEFAULT_THEME, isThemeId, ThemeId } from './theme';

/**
 * Field of the origin-wide `preferences` cookie holding the theme. The editor
 * and the legacy pages use the same `light`/`dark` values, so a switch on any
 * of them moves all three.
 */
const PREFERENCE_FIELD = 'theme';

/**
 * The colour scheme, applied to `<html>` as the class `@logigator/ui`'s dark
 * tokens key off.
 *
 * Construction applies it, and it runs during the server render, so the class
 * is in the first byte and the page never paints light before hydration.
 */
@Injectable({ providedIn: 'root' })
export class ThemingService {
  private readonly preferences = inject(PreferencesService);
  private readonly document = inject(DOCUMENT);

  private readonly _theme = signal<ThemeId>(DEFAULT_THEME);
  public readonly theme = this._theme.asReadonly();
  public readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    this.apply(this.stored() ?? DEFAULT_THEME);
  }

  public setTheme(theme: ThemeId): void {
    this.apply(theme);
    this.preferences.set(PREFERENCE_FIELD, theme);
  }

  public toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  /**
   * The shared preference, or `null` where there is none or it names a scheme
   * this app cannot render. An unreadable value is left in the cookie rather
   * than repaired: it may mean something to another page on the origin.
   */
  private stored(): ThemeId | null {
    const theme = this.preferences.get(PREFERENCE_FIELD);
    return isThemeId(theme) ? theme : null;
  }

  private apply(theme: ThemeId): void {
    this._theme.set(theme);
    this.document.documentElement.classList.toggle(
      DARK_THEME_CLASS,
      theme === 'dark'
    );
  }
}
