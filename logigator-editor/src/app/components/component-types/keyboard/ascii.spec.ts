import { describe, expect, it } from 'vitest';
import { ASCII_MNEMONICS, codeFromBits, readoutText } from './ascii';

describe('keyboard ASCII', () => {
  it('reads every control key the keyboard sends as its mnemonic', () => {
    expect(readoutText(0x0a)).toBe('LF');
    expect(readoutText(0x08)).toBe('BS');
    expect(readoutText(0x09)).toBe('TAB');
    expect(readoutText(0x1b)).toBe('ESC');
    expect(readoutText(0x7f)).toBe('DEL');
    expect(readoutText(0x20)).toBe('SP');
  });

  it('reads a printable character as itself and zero as nothing', () => {
    for (let code = 0x21; code <= 0x7e; code++) {
      expect(readoutText(code)).toBe(String.fromCharCode(code));
    }
    expect(readoutText(0)).toBe('');
  });

  it('gives every non-zero code a readout of at most three canvas glyphs', () => {
    for (let code = 1; code <= 0x7f; code++) {
      const text = readoutText(code);
      expect(text.length, `code ${code}`).toBeGreaterThan(0);
      expect(text.length, `code ${code}`).toBeLessThanOrEqual(3);
      // The canvas atlas starts at space; a control character would draw
      // nothing.
      expect(/^[!-~]+$/.test(text), `code ${code}: ${text}`).toBe(true);
    }
    expect(new Set(ASCII_MNEMONICS.values()).size).toBe(ASCII_MNEMONICS.size);
  });

  it('decodes D0 as the least significant of seven bits', () => {
    for (let code = 0; code <= 0x7f; code++) {
      expect(codeFromBits((bit) => ((code >> bit) & 1) === 1)).toBe(code);
    }
    // An eighth bit is not a data output.
    expect(codeFromBits((bit) => bit === 7)).toBe(0);
  });
});
