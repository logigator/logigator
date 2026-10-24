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
 * Starts the editor with the cookie already in place, as a page load has it:
 * it is read once, when the service reading it is constructed.
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

    // The theme belongs to the rest of the origin too, so a language write
    // that dropped it would reset their theme.
    expect(preferences.read()).toEqual({ lang: 'fr', theme: 'light' });
  });

  it('writes a cookie the server-side encoding round-trips', () => {
    const preferences = startEditor({ lang: 'de', theme: 'light' });

    preferences.set('lang', 'es');

    // Read through document.cookie, so the assertion covers the encoding a
    // fresh page load sees.
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
    // The server validates each preference on its own, so one unrecognized
    // value leaves the other field alone.
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
    // Establishing the cookie is the server's job: a language and theme the
    // user never picked would be asserted for every page on the origin.
    startEditor();

    expect(document.cookie).not.toContain('preferences=');
  });

  it('falls back to no preferences when the cookie is malformed', () => {
    // Client-writable, so anything but the server's encoding reads as absent.
    document.cookie = 'preferences=not-json;path=/';

    expect(startEditor().get('lang')).toBeNull();
  });
});
