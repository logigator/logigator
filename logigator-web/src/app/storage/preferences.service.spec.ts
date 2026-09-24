import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { PreferencesService } from './preferences.service';

function writeServerCookie(preferences: Record<string, unknown>): void {
  document.cookie = `preferences=${encodeURIComponent(
    `j:${JSON.stringify(preferences)}`
  )};path=/`;
}

function clearCookie(): void {
  document.cookie =
    'preferences=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

describe('PreferencesService', () => {
  beforeEach(() => {
    clearCookie();
    configureTestBed();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    clearCookie();
  });

  it('reads a cookie the legacy backend wrote', () => {
    // Until the cutover both stacks write it, and Express serializes an object
    // value as `j:` + JSON, URI-encoded.
    writeServerCookie({ lang: 'de', theme: 'light' });

    expect(TestBed.inject(PreferencesService).get('lang')).toBe('de');
  });

  it('leaves fields it does not know about intact on a write', () => {
    // The cookie is shared, so overwriting it wholesale would silently drop
    // whatever another page on the origin keeps there.
    writeServerCookie({ lang: 'de', theme: 'dark', acceptedCookies: '1' });

    const preferences = TestBed.inject(PreferencesService);
    preferences.set('theme', 'light');

    expect(preferences.read()).toEqual({
      lang: 'de',
      theme: 'light',
      acceptedCookies: '1'
    });
  });

  it('reports no value for a field holding a non-string', () => {
    writeServerCookie({ lang: 42 });

    expect(TestBed.inject(PreferencesService).get('lang')).toBeNull();
  });
});
