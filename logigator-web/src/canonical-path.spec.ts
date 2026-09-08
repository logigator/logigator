import { describe, expect, it } from 'vitest';
import { canonicalPath } from './canonical-path';

describe('canonicalPath', () => {
  it('leaves a canonical path alone', () => {
    expect(canonicalPath('/en/verify-email/abc')).toBeNull();
    expect(canonicalPath('/')).toBeNull();
  });

  it('collapses repeated separators', () => {
    expect(canonicalPath('/en//verify-email/abc')).toBe('/en/verify-email/abc');
    expect(canonicalPath('/en/verify-email/abc//')).toBe(
      '/en/verify-email/abc'
    );
  });

  it('drops a trailing slash', () => {
    expect(canonicalPath('/en/login/')).toBe('/en/login');
    expect(canonicalPath('/en/')).toBe('/en');
  });

  it('is a fixed point: its own output is canonical', () => {
    for (const path of ['/en//', '///', '/en///login//']) {
      expect(canonicalPath(canonicalPath(path) as string)).toBeNull();
    }
  });

  it('keeps an encoded separator inside a segment', () => {
    expect(canonicalPath('/en/verify-email/a%2F%2Fb')).toBeNull();
  });
});
