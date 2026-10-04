import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ThemingService } from './theming.service';
import { PreferencesService } from '../storage/preferences.service';

function writeServerCookie(preferences: Record<string, unknown>): void {
  document.cookie = `preferences=${encodeURIComponent(
    `j:${JSON.stringify(preferences)}`
  )};path=/`;
}

function clearCookie(): void {
  document.cookie =
    'preferences=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/** Loads the page with the given cookie in place: the theme is read once. */
function loadPage(preferences?: Record<string, unknown>): ThemingService {
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

  it('renders in the theme the rest of the origin uses', () => {
    loadPage({ lang: 'en', theme: 'light' });

    expect(document.documentElement.classList.contains('dark-mode')).toBe(
      false
    );
  });

  it('leaves a theme it cannot render for the origin to keep', () => {
    // Overwriting the field would discard a preference another page on the
    // origin may understand; falling back is a rendering decision only.
    const theming = loadPage({ theme: 'sepia' });

    expect(theming.isDark()).toBe(true);
    expect(TestBed.inject(PreferencesService).get('theme')).toBe('sepia');
  });

  it('does not claim a theme for the origin on load', () => {
    loadPage();

    expect(TestBed.inject(PreferencesService).get('theme')).toBeNull();
  });

  it('shares a switch with the rest of the origin', () => {
    const theming = loadPage({ lang: 'de', theme: 'dark' });

    theming.setTheme('light');

    const preferences = TestBed.inject(PreferencesService);
    expect(preferences.get('theme')).toBe('light');
    expect(preferences.get('lang')).toBe('de');
    expect(document.documentElement.classList.contains('dark-mode')).toBe(
      false
    );
  });
});
