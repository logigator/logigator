import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { CookieService } from './cookie.service';

/** Removes a cookie for the current path so tests stay isolated. */
function clearCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe('CookieService', () => {
  let hadCookieStore: boolean;

  beforeEach(() => {
    hadCookieStore = 'cookieStore' in window;
    configureTestBed();
  });

  afterEach(() => {
    // Destroy the injector (runs the service's ngOnDestroy) while the stubbed
    // cookieStore is still in place, then remove the stub.
    TestBed.resetTestingModule();
    clearCookie('tutorials');
    if (!hadCookieStore) {
      delete (window as unknown as { cookieStore?: unknown }).cookieStore;
    }
  });

  it('reads existing cookies synchronously at construction', () => {
    document.cookie = 'tutorials=abc;path=/';

    // No await/tick: the value must be available on the first synchronous read.
    expect(TestBed.inject(CookieService).get('tutorials')).toBe('abc');
  });

  it('seeds from document.cookie even when cookieStore reads are async', () => {
    // Force the cookieStore branch with a getAll() that never resolves; without
    // the synchronous seed the map would stay empty until that promise settles.
    (window as unknown as { cookieStore: unknown }).cookieStore = {
      getAll: () => new Promise<never>(() => undefined),
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    };
    document.cookie = 'tutorials=abc;path=/';

    expect(TestBed.inject(CookieService).get('tutorials')).toBe('abc');
  });
});
