import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it('keeps a path on this origin, query and fragment included', () => {
    expect(safeReturnPath('/de/community/projects?page=2#top')).toBe(
      '/de/community/projects?page=2#top'
    );
  });

  it('refuses everything a browser would read as another origin', () => {
    for (const value of [
      '//evil.test/phish',
      '/\\evil.test/phish',
      'https://evil.test',
      'javascript:alert(1)',
      'de/community',
      '',
      null,
      undefined
    ]) {
      expect(safeReturnPath(value)).toBeNull();
    }
  });

  it('refuses a value that could split the redirect header', () => {
    expect(safeReturnPath('/de\r\nSet-Cookie: a=b')).toBeNull();
  });
});
