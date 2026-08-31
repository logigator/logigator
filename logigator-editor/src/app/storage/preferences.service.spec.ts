import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { PreferencesService } from './preferences.service';

/** Writes the cookie the way express does: `j:` + JSON, URI-encoded. */
function writeServerCookie(preferences: Record<string, unknown>): void {
  const value = encodeURIComponent(`j:${JSON.stringify(preferences)}`);
  document.cookie = `preferences=${value};path=/`;
}

function clearCookie(): void {
  document.cookie =
    'preferences=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/**
 * Starts the editor with the given cookie in place. The cookie has to exist
 * before bootstrap, as it does on a page load: it is read once, when the service
 * reading it is constructed.
 */
function startEditor(
  preferences?: Record<string, unknown>
): PreferencesService {
  if (preferences) {
    writeServerCookie(preferences);
  }
  configureTestBed();
  return TestBed.inject(PreferencesService);
}

describe('PreferencesService', () => {
  beforeEach(() => {
    clearCookie();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    clearCookie();
  });

  it('reads the fields of a cookie the server wrote', () => {
    const preferences = startEditor({ lang: 'de', theme: 'light' });

    expect(preferences.get('lang')).toBe('de');
    expect(preferences.get('theme')).toBe('light');
  });

  it('keeps the fields it does not write', () => {
    const preferences = startEditor({ lang: 'de', theme: 'light' });

    preferences.set('lang', 'fr');

    // The theme belongs to the pages on the rest of the origin as much as to the
    // editor: a language write that dropped it would reset their theme.
    expect(preferences.read()).toEqual({ lang: 'fr', theme: 'light' });
  });

  it('writes a cookie the server-side encoding round-trips', () => {
    const preferences = startEditor({ lang: 'de', theme: 'light' });

    preferences.set('lang', 'es');

    // Re-read through document.cookie rather than the service's own map, so the
    // assertion covers the encoding a fresh page load (or the server) sees.
    const raw = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith('preferences='))
      ?.slice('preferences='.length);
    expect(JSON.parse(decodeURIComponent(raw ?? '').slice(2))).toEqual({
      lang: 'es',
      theme: 'light'
    });
  });

  it('leaves a field the server has to repair alone', () => {
    // The server validates each preference on its own, so an unrecognized value
    // is repaired without the editor touching (or clearing) the other field.
    const preferences = startEditor({ lang: 'de', theme: 'sepia' });

    preferences.set('lang', 'fr');

    expect(preferences.read()).toEqual({ lang: 'fr', theme: 'sepia' });
  });

  it('drops a single field without touching the others', () => {
    const preferences = startEditor({ lang: 'de', theme: 'light' });

    preferences.remove('lang');

    expect(preferences.read()).toEqual({ theme: 'light' });
  });

  it('writes nothing on a load where the user chooses nothing', () => {
    // Establishing the cookie belongs to the server, which does it on the next
    // page view: the editor writing a language and theme the user never picked
    // would assert them for every other page on the origin.
    startEditor();

    expect(document.cookie).not.toContain('preferences=');
  });

  it('falls back to no preferences when the cookie is malformed', () => {
    // The cookie is client-writable, so a value that is not the server's
    // encoding has to read as absent rather than throw.
    document.cookie = 'preferences=not-json;path=/';

    expect(startEditor().get('lang')).toBeNull();
  });
});
