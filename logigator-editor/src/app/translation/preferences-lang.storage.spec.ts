import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GetLangParams, PersistStorage } from '@jsverse/transloco-persist-lang';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  preferencesLangStorage,
  resolveStartupLang
} from './preferences-lang.storage';

function writeServerCookie(preferences: Record<string, unknown>): void {
  const value = encodeURIComponent(`j:${JSON.stringify(preferences)}`);
  document.cookie = `preferences=${value};path=/`;
}

function clearCookie(): void {
  document.cookie =
    'preferences=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/**
 * Starts the editor with the given cookie in place and builds the storage
 * adapter against it. The cookie has to exist before bootstrap, as it does on a
 * page load: it is read once, when the service reading it is constructed.
 */
function startEditor(preferences?: Record<string, unknown>): PersistStorage {
  if (preferences) {
    writeServerCookie(preferences);
  }
  configureTestBed();
  return TestBed.runInInjectionContext(() => preferencesLangStorage());
}

describe('preferencesLangStorage', () => {
  beforeEach(() => {
    clearCookie();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    clearCookie();
  });

  it('reads the language the rest of the origin uses', () => {
    expect(startEditor({ lang: 'de', theme: 'dark' }).getItem('lang')).toBe(
      'de'
    );
  });

  it('reports no language for one the editor has no translations for', () => {
    // The server offers the same four languages today, but the sets are
    // independent and the cookie is client-writable.
    expect(
      startEditor({ lang: 'it', theme: 'dark' }).getItem('lang')
    ).toBeNull();
  });

  it('writes the language back into the shared cookie', () => {
    const storage = startEditor({ lang: 'de', theme: 'light' });

    storage.setItem('lang', 'fr');

    expect(storage.getItem('lang')).toBe('fr');
    expect(document.cookie).toContain(encodeURIComponent('"theme":"light"'));
  });
});

describe('resolveStartupLang', () => {
  const params = (overrides: Partial<GetLangParams>): GetLangParams => ({
    cachedLang: null,
    browserLang: undefined,
    cultureLang: '',
    defaultLang: 'en',
    ...overrides
  });

  /** The browser's `Accept-Language` list, in preference order. */
  function requestLanguages(...languages: string[]): void {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers the shared preference over the browser language', () => {
    requestLanguages('fr');

    expect(resolveStartupLang(params({ cachedLang: 'de' }))).toBe('de');
  });

  it('falls back to the browser language when there is no cookie yet', () => {
    // The editor bundle is served ahead of the middleware that writes the
    // cookie, so a first request straight to /editor/ has no preference.
    requestLanguages('fr-CA', 'fr');

    expect(resolveStartupLang(params({}))).toBe('fr');
  });

  it('follows the browser down its list past languages it cannot render', () => {
    // The same negotiation the server runs over Accept-Language — the language
    // resolved here seeds the shared cookie, so the two have to agree.
    requestLanguages('it', 'de', 'en');

    expect(resolveStartupLang(params({}))).toBe('de');
  });

  it('falls back to the default when the browser wants none of them', () => {
    requestLanguages('it');

    expect(resolveStartupLang(params({}))).toBe('en');
  });

  it('uses the primary language when the browser lists none', () => {
    // Some browsers report an empty list in private mode; the primary language
    // is still the user's.
    requestLanguages();
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE');

    expect(resolveStartupLang(params({}))).toBe('de');
  });
});
