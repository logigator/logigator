import { describe, expect, it } from 'vitest';
import { KEYBOARD_STROBE_OUTPUT } from '@logigator/core';
import {
  ASCII_MNEMONICS,
  characterOfKey,
  codeFromBits,
  pressFrame,
  readoutText,
  releaseFrame,
  resetFrame,
  tapFrames,
  textToCodes,
  textToCodesStrict
} from './ascii';

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

  it('sends each control key and every printable key as its code', () => {
    const controls: [string, number][] = [
      ['Enter', 0x0a],
      ['Backspace', 0x08],
      ['Tab', 0x09],
      ['Escape', 0x1b],
      ['Delete', 0x7f],
      [' ', 0x20]
    ];
    for (const [key, code] of controls) {
      expect(characterOfKey(key), key).toEqual({ kind: 'ascii', code });
    }
    for (let code = 0x21; code <= 0x7e; code++) {
      expect(characterOfKey(String.fromCharCode(code))).toEqual({
        kind: 'ascii',
        code
      });
    }
  });

  it('skips a character outside ASCII and leaves keys without one alone', () => {
    for (const char of ['ä', '€', '°', '😀']) {
      expect(characterOfKey(char)).toEqual({ kind: 'skipped', char });
    }
    for (const key of ['ArrowUp', 'F1', 'Home', 'Insert', 'Shift', 'Dead']) {
      expect(characterOfKey(key), key).toBeNull();
    }
  });

  it('ends every line of a text with LF and drops the other control characters', () => {
    const text = textToCodes('a\r\nb\rc\n\td\u0000\u0007\u001b\u007fe');
    expect(String.fromCharCode(...text.codes)).toBe('a\nb\nc\n\tde');
    expect(text.skipped).toEqual([]);
    expect(text.truncated).toBe(false);
  });

  it('skips and lists every character of a text outside ASCII', () => {
    const text = textToCodes('Grüße, 20 €😀!');
    expect(String.fromCharCode(...text.codes)).toBe('Gre, 20 !');
    expect(text.skipped).toEqual(['ü', 'ß', '€', '😀']);
  });

  it('reads a text strictly as every control key and printable character, CRLF and CR as LF', () => {
    const text = textToCodesStrict('a\r\nb\rc\n\t\b\u001b\u007f ~');
    expect(text).toEqual({
      kind: 'codes',
      codes: [
        0x61, 0x0a, 0x62, 0x0a, 0x63, 0x0a, 0x09, 0x08, 0x1b, 0x7f, 0x20, 0x7e
      ]
    });
  });

  it('refuses a strict text at its first unsendable character, by its index in the text', () => {
    expect(textToCodesStrict('😀a\r\nä€')).toEqual({
      kind: 'unsendable',
      char: '😀',
      index: 0
    });
    expect(textToCodesStrict('a\r\nä€')).toEqual({
      kind: 'unsendable',
      char: 'ä',
      index: 3
    });
    expect(textToCodesStrict('ok\u0007')).toEqual({
      kind: 'unsendable',
      char: '\u0007',
      index: 2
    });
  });

  it('stops a text after the limit and says so', () => {
    expect(textToCodes('abc', 3)).toEqual({
      codes: [0x61, 0x62, 0x63],
      skipped: [],
      truncated: false
    });
    const cut = textToCodes('ab\ncd', 3);
    expect(cut.codes).toEqual([0x61, 0x62, 0x0a]);
    expect(cut.truncated).toBe(true);
  });

  it('never produces NUL, from a key or from text', () => {
    let all = '';
    for (let point = 0; point <= 0xffff; point++) {
      if (point >= 0xd800 && point <= 0xdfff) continue;
      const char = String.fromCodePoint(point);
      all += char;
      const character = characterOfKey(char);
      if (character?.kind === 'ascii') {
        expect(character.code, `U+${point.toString(16)}`).not.toBe(0);
      }
    }
    expect(textToCodes(all, Infinity).codes).not.toContain(0);
    expect(textToCodesStrict('\u0000').kind).toBe('unsendable');
    expect(() => pressFrame(0)).toThrow(RangeError);
  });

  it('presses with all seven data bits and the strobe pulse in one counted event frame', () => {
    const frame = pressFrame(0x55);
    expect(frame.kind).toBe('event');
    expect(frame.counted).toBe(true);
    expect(frame.writes).toEqual([
      { slot: 0, drive: 'level', value: true },
      { slot: 1, drive: 'level', value: false },
      { slot: 2, drive: 'level', value: true },
      { slot: 3, drive: 'level', value: false },
      { slot: 4, drive: 'level', value: true },
      { slot: 5, drive: 'level', value: false },
      { slot: 6, drive: 'level', value: true },
      { slot: KEYBOARD_STROBE_OUTPUT, drive: 'pulse', value: true }
    ]);
  });

  it('releases, and resets, with all seven data bits low and no strobe', () => {
    const lows = Array.from({ length: 7 }, (_, slot) => ({
      slot,
      drive: 'level',
      value: false
    }));
    expect(releaseFrame()).toEqual({ kind: 'event', writes: lows });
    expect(releaseFrame().counted).toBeFalsy();
    expect(resetFrame()).toEqual({ kind: 'state', writes: lows });
  });

  it('taps each code as its press followed by a release', () => {
    expect(tapFrames([0x6c, 0x0a])).toEqual([
      pressFrame(0x6c),
      releaseFrame(),
      pressFrame(0x0a),
      releaseFrame()
    ]);
  });
});
