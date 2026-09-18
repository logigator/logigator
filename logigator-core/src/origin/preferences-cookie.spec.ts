import { describe, expect, it } from 'vitest';
import {
  decodePreferences,
  encodePreferences,
  parseCookieHeader,
  PREFERENCES_COOKIE
} from './preferences-cookie';

describe('preferences cookie', () => {
  it('round-trips the fields it carries', () => {
    const preferences = { lang: 'de', theme: 'dark' };

    expect(decodePreferences(encodePreferences(preferences))).toEqual(
      preferences
    );
  });

  it('keeps fields it does not know about', () => {
    // Every app on the origin writes this cookie, so a write must not drop
    // what another one put there.
    const encoded = encodePreferences({ lang: 'fr', somethingElse: 7 });

    expect(decodePreferences(encoded)['somethingElse']).toBe(7);
  });

  it('absorbs a malformed value rather than throwing', () => {
    // Client-writable, so garbage in it is a state every consumer survives by
    // falling back to its own default.
    expect(decodePreferences('j:{not json')).toEqual({});
    expect(decodePreferences('plain-string')).toEqual({});
    expect(decodePreferences('j:"a string"')).toEqual({});
    expect(decodePreferences(null)).toEqual({});
  });

  it('reads its value out of a cookie header naming several', () => {
    const header = `theme=x; ${PREFERENCES_COOKIE}=${encodePreferences({
      lang: 'es'
    })}; other=y`;

    expect(
      decodePreferences(parseCookieHeader(header)[PREFERENCES_COOKIE]).lang
    ).toBe('es');
  });

  it('keeps a value containing the separator intact', () => {
    // The encoding is JSON, so `=` inside a value is ordinary; splitting on
    // every `=` rather than the first would truncate it.
    expect(parseCookieHeader('a=b=c')).toEqual({ a: 'b=c' });
  });
});
