import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ThemingService } from './theming.service';
import { PreferencesService } from '../storage/preferences.service';
import { ThemeType } from './theme-type.enum';

function writeServerCookie(preferences: Record<string, unknown>): void {
  const value = encodeURIComponent(`j:${JSON.stringify(preferences)}`);
  document.cookie = `preferences=${value};path=/`;
}

function clearCookie(): void {
  document.cookie =
    'preferences=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/**
 * Starts the editor with the given cookie in place. The cookie must exist
 * before bootstrap, as on a page load: the theme is read once, at construction.
 */
function startEditor(preferences?: Record<string, unknown>): ThemingService {
  if (preferences) {
    writeServerCookie(preferences);
  }
  configureTestBed();
  return TestBed.inject(ThemingService);
}

describe('ThemingService', () => {
  beforeEach(() => {
    clearCookie();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    clearCookie();
    document.documentElement.classList.remove('dark-mode');
  });

  it('starts in the theme the rest of the origin uses', () => {
    const theming = startEditor({ lang: 'en', theme: 'light' });

    expect(theming.currentThemeType()).toBe(ThemeType.LIGHT);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(
      false
    );
  });

  it('starts dark for a user with no theme preference', () => {
    expect(startEditor().currentThemeType()).toBe(ThemeType.DARK);
  });

  it('leaves a theme it cannot render for the server to repair', () => {
    const theming = startEditor({ lang: 'de', theme: 'sepia' });

    // Falling back to dark is a rendering decision; overwriting the field
    // would discard a preference the surrounding pages may understand.
    expect(theming.currentThemeType()).toBe(ThemeType.DARK);
    expect(TestBed.inject(PreferencesService).get('theme')).toBe('sepia');
  });

  it('does not claim a theme for the origin on load', () => {
    // Dark is applied as a fallback but not written: that would push a theme
    // the user never chose onto every other page. The server establishes the
    // cookie on the next page view, from the same default.
    startEditor();

    expect(TestBed.inject(PreferencesService).get('theme')).toBeNull();
  });

  it('shares a theme switch with the rest of the origin', () => {
    const theming = startEditor({ lang: 'de', theme: 'dark' });

    theming.setTheme(ThemeType.LIGHT);

    const preferences = TestBed.inject(PreferencesService);
    expect(preferences.get('theme')).toBe('light');
    expect(preferences.get('lang')).toBe('de');
  });
});
