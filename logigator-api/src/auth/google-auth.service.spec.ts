import { describe, expect, it } from 'vitest';
import { usernameSchema } from '@logigator/contract';
import { usernameFrom } from './google-auth.service';

/**
 * A Google display name is free text and the address' local part barely more
 * constrained. The column takes either; the contract does not, and a username
 * the API's own schema rejects is a value no reader expects to exist.
 */
describe('usernameFrom', () => {
  it.each([
    ['a display name with a space', 'Ada Lovelace', 'lovelace@example.com'],
    ['a display name over the limit', 'A'.repeat(40), 'long@example.com'],
    ['a display name of punctuation', '???', 'punct@example.com'],
    ['a display name with accents', 'Ædа Lóvelace', 'accents@example.com'],
    ['no display name', undefined, 'grace.hopper+navy@example.com'],
    ['a local part of punctuation only', undefined, '...@example.com'],
    ['a local part of one character', undefined, 'a@example.com']
  ])('answers a valid username for %s', (_, name, email) => {
    expect(usernameSchema.safeParse(usernameFrom(name, email)).success).toBe(
      true
    );
  });

  it('keeps what it can of the name it was given', () => {
    expect(usernameFrom('Ada Lovelace', 'x@example.com')).toBe('Ada Lovelace');
    expect(usernameFrom('Tom Jäger#2', 'x@example.com')).toBe('Tom Jäger2');
    expect(usernameFrom(undefined, 'grace.hopper@example.com')).toBe(
      'grace.hopper'
    );
  });

  it('never makes an address into a public name', () => {
    expect(usernameFrom('ada@example.com', 'ada@example.com')).toBe('ada');
  });

  it('falls back to the address when no Latin letter is left', () => {
    expect(usernameFrom('Дмитрий', 'dmitri@example.com')).toBe('dmitri');
  });
});
