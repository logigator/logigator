import { describe, expect, it } from 'vitest';
import { CONSENT_CATEGORIES } from '../consent-cookie';
import { consentCopy } from './consent-text';

describe('consentCopy', () => {
  it('lists every category a visitor can grant, and locks only the necessary', () => {
    // A category missing from the dialog could be granted by nobody.
    const copy = consentCopy((key) => key, '/privacy-policy');

    expect(copy.categories.map(({ id }) => id)).toEqual([
      'necessary',
      ...CONSENT_CATEGORIES
    ]);
    expect(
      copy.categories.filter(({ required }) => required).map(({ id }) => id)
    ).toEqual(['necessary']);
  });
});
