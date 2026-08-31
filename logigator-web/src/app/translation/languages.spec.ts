import { describe, expect, it } from 'vitest';
import { negotiateLanguage, parseAcceptLanguage } from './languages';

describe('parseAcceptLanguage', () => {
  it('orders by quality rather than by position', () => {
    // A browser configured with a secondary language sends it at a lower `q`,
    // not later in the list, so reading the header in order picks the wrong one.
    expect(parseAcceptLanguage('de;q=0.7, fr;q=0.9')).toEqual(['fr', 'de']);
  });

  it('drops the wildcard', () => {
    // `*` means "anything", which is what falling through to the default
    // already does — matching it as a tag would shadow a real preference.
    expect(parseAcceptLanguage('it, *;q=0.5')).toEqual(['it']);
  });

  it('drops tags the client explicitly refuses', () => {
    expect(parseAcceptLanguage('de, fr;q=0')).toEqual(['de']);
  });
});

describe('negotiateLanguage', () => {
  it('follows the list past languages the site cannot render', () => {
    expect(negotiateLanguage(['it', 'de', 'en'])).toBe('de');
  });

  it('ignores the region subtag', () => {
    expect(negotiateLanguage(['de-AT'])).toBe('de');
  });

  it('reports none for a list naming none', () => {
    expect(negotiateLanguage(['it', 'ja'])).toBeNull();
  });
});
