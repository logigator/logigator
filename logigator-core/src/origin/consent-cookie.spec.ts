import { describe, expect, it } from 'vitest';
import {
  CONSENT_REVISION,
  decodeConsent,
  encodeConsent
} from './consent-cookie';

describe('consent cookie', () => {
  it('round-trips a grant and a refusal', () => {
    expect(decodeConsent(encodeConsent(['analytics']))).toEqual(['analytics']);
    // Refusing everything optional is a decision, distinct from no cookie.
    expect(decodeConsent(encodeConsent([]))).toEqual([]);
  });

  it('writes a value that needs no encoding to be a cookie', () => {
    // Both cookie services write the value raw.
    expect(encodeConsent(['analytics'])).toMatch(/^[\w.]+$/);
  });

  it('reads a decision from another revision as no decision', () => {
    // Bumping the revision is how a changed question reaches every visitor.
    expect(decodeConsent(`${CONSENT_REVISION + 1}.analytics`)).toBeNull();
    expect(decodeConsent(`${CONSENT_REVISION - 1}`)).toBeNull();
  });

  it('asks again rather than guessing at a malformed value', () => {
    expect(decodeConsent(null)).toBeNull();
    expect(decodeConsent('')).toBeNull();
    expect(decodeConsent('analytics')).toBeNull();
    expect(decodeConsent('{"categories":["analytics"]}')).toBeNull();
  });

  it('grants nothing a value names that is not a category', () => {
    // Client-writable: a hand-edited name must not grant anything.
    expect(decodeConsent(`${CONSENT_REVISION}.marketing`)).toEqual([]);
    expect(encodeConsent(['marketing', 'analytics'])).toBe(
      encodeConsent(['analytics'])
    );
  });
});
