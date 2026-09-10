import { describe, expect, it } from 'vitest';
import { negotiateRequestLanguage } from './language-negotiation';

function preferencesCookie(preferences: Record<string, unknown>): string {
  return `preferences=${encodeURIComponent(`j:${JSON.stringify(preferences)}`)}`;
}

describe('negotiateRequestLanguage', () => {
  it('prefers the shared cookie over the browser list', () => {
    expect(
      negotiateRequestLanguage({
        cookie: preferencesCookie({ lang: 'de' }),
        acceptLanguage: 'fr'
      })
    ).toBe('de');
  });

  it('falls through to the browser list for a language it cannot render', () => {
    // The cookie is shared with two other stacks and is client-writable, so its
    // language set is not guaranteed to be this app's.
    expect(
      negotiateRequestLanguage({
        cookie: preferencesCookie({ lang: 'it' }),
        acceptLanguage: 'fr'
      })
    ).toBe('fr');
  });

  it('absorbs a malformed cookie', () => {
    expect(
      negotiateRequestLanguage({
        cookie: 'preferences=not-json',
        acceptLanguage: 'es'
      })
    ).toBe('es');
  });

  it('ignores other cookies on the header', () => {
    expect(
      negotiateRequestLanguage({
        cookie: `isAuthenticated=true; ${preferencesCookie({ lang: 'fr' })}`
      })
    ).toBe('fr');
  });

  it('defaults when a request expresses no preference at all', () => {
    expect(negotiateRequestLanguage({})).toBe('en');
  });
});
