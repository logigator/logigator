import { describe, expect, it } from 'vitest';
import { documentShortcut, isLanguagelessName } from './translation-shortcuts';

describe('isLanguagelessName', () => {
  it('holds for names without a letter of any script', () => {
    for (const name of ['74', '2:1', '+/-', '1 + 1 = 2', '#42', '​7​']) {
      expect(isLanguagelessName(name)).toBe(true);
    }
  });

  it('leaves every name with a letter to the model', () => {
    for (const name of ['CPU', '74HC595', 'ä', 'SAP-1', '加法器', 'x2']) {
      expect(isLanguagelessName(name)).toBe(false);
    }
  });
});

describe('documentShortcut', () => {
  it('settles an empty description and a languageless name without the model', () => {
    expect(documentShortcut({ name: '1234', description: '' })).toEqual({
      name: 'zxx',
      description: 'zxx'
    });
  });

  it('counts a description of nothing but blanks and invisibles as empty', () => {
    expect(
      documentShortcut({ name: 'Adder', description: ' \n​\n ' }).description
    ).toBe('zxx');
  });

  it('leaves a field with text to its authors or the model', () => {
    expect(
      documentShortcut({ name: 'Adder', description: 'Adds bits.' })
    ).toEqual({ name: 'human', description: 'human' });
  });
});
