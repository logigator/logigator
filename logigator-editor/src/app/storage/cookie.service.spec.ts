import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    clearCookie('tutorials');
  });

  afterEach(() => {
    // ngOnDestroy has to run while the stubbed cookieStore is still there.
    TestBed.resetTestingModule();
    clearCookie('tutorials');
    clearCookie('preferences');
    if (!hadCookieStore) {
      delete (window as unknown as { cookieStore?: unknown }).cookieStore;
    }
  });

  it('reads existing cookies synchronously at construction', () => {
    // Set before bootstrap, as a page load has it.
    document.cookie = 'tutorials=abc;path=/';
    configureTestBed();

    // The value must be there on the first synchronous read.
    expect(TestBed.inject(CookieService).get('tutorials')).toBe('abc');
  });

  it('writes for the whole origin, readable before any change event', () => {
    configureTestBed();
    const service = TestBed.inject(CookieService);
    const write = vi.spyOn(document, 'cookie', 'set');

    service.set('tutorials', 'abc');

    // Written for `/`: a path-scoped copy shadows the origin-wide cookie on
    // editor requests and is invisible to the rest of the site.
    expect(write).toHaveBeenCalledWith(expect.stringContaining('path=/'));
    // The mirror into the reactive map is synchronous; cookieStore change
    // events arrive a task later.
    expect(service.get('tutorials')).toBe('abc');
  });

  it('seeds from document.cookie even when cookieStore reads are async', () => {
    // A getAll() that never resolves: without the synchronous seed the map
    // would stay empty until it settles.
    (window as unknown as { cookieStore: unknown }).cookieStore = {
      getAll: () => new Promise<never>(() => undefined),
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    };
    document.cookie = 'tutorials=abc;path=/';
    configureTestBed();

    expect(TestBed.inject(CookieService).get('tutorials')).toBe('abc');
  });
});
