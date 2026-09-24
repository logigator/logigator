import { describe, expect, it } from 'vitest';
import { normalizeAuthoredText } from './authored-text';

describe('normalizeAuthoredText', () => {
  it('leaves text that is already clean exactly as it was', () => {
    const text = 'A 4-bit adder.\n\nUses two half adders and an OR gate.';
    expect(normalizeAuthoredText(text)).toBe(text);
  });

  it('composes to NFC, so one spelling of a word is one string', () => {
    // `e` + combining acute against the precomposed `é`.
    const decomposed = 'Entrée';
    const composed = 'Entrée';
    expect(decomposed).not.toBe(composed);
    expect(normalizeAuthoredText(decomposed)).toBe(composed);
  });

  it('does not fold compatibility forms, which would rewrite the word', () => {
    // NFKC would answer 'fi' and 'KELVIN'; both are a different word on screen.
    expect(normalizeAuthoredText('ﬁle')).toBe('ﬁle');
    expect(normalizeAuthoredText('Ｋ')).toBe('Ｋ');
  });

  it('strips the bidi overrides that reorder what a reader sees', () => {
    // Stored as one thing, drawn as another — the whole point of the class.
    expect(normalizeAuthoredText('safe\u202etxt.exe')).toBe('safetxt.exe');
    for (const mark of [
      '\u202a',
      '\u202b',
      '\u202c',
      '\u202d',
      '\u2066',
      '\u2069'
    ]) {
      expect(normalizeAuthoredText(`a${mark}b`)).toBe('ab');
    }
  });

  it('strips zero-width characters, which split a word against a search', () => {
    expect(normalizeAuthoredText('sc\u200bript')).toBe('script');
    expect(normalizeAuthoredText('\ufeffbom')).toBe('bom');
  });

  it('removes a leading zero-width space rather than leaving a blank behind', () => {
    // `.trim()` alone does not: it would strip the space and keep the U+200B,
    // or strip neither. This is why the trim comes last.
    expect(normalizeAuthoredText('\u200b hello')).toBe('hello');
    expect(normalizeAuthoredText('hello \u200b')).toBe('hello');
  });

  it('strips control characters but keeps newline and tab', () => {
    expect(normalizeAuthoredText('a\u0000b')).toBe('ab');
    expect(normalizeAuthoredText('a\u0007b')).toBe('ab');
    expect(normalizeAuthoredText('a\u001bb')).toBe('ab');
    expect(normalizeAuthoredText('a\u009bb')).toBe('ab');
    // An indented code block is a tab or four spaces; both are real content.
    expect(normalizeAuthoredText('one\n\tcode()')).toBe('one\n\tcode()');
  });

  it('answers one kind of line break', () => {
    expect(normalizeAuthoredText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
    // A paragraph break survives as a paragraph break.
    expect(normalizeAuthoredText('one\r\n\r\ntwo')).toBe('one\n\ntwo');
  });

  it('keeps emoji, astral characters and right-to-left script intact', () => {
    expect(normalizeAuthoredText('a clock \u{1f551} circuit')).toBe(
      'a clock \u{1f551} circuit'
    );
    // ZWJ is what makes this one glyph rather than two, so it has to survive.
    expect(normalizeAuthoredText('\u{1f469}\u200d\u{1f4bb}')).toBe(
      '\u{1f469}\u200d\u{1f4bb}'
    );
    // ZWNJ is a word-internal boundary in Persian, not decoration.
    expect(
      normalizeAuthoredText('\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645')
    ).toBe('\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645');
    // The directional marks set a neutral character's side; they cannot
    // reverse a run, so they are legitimate and stay.
    expect(normalizeAuthoredText('(\u200f)')).toBe('(\u200f)');
    expect(normalizeAuthoredText('مرحبا')).toBe('مرحبا');
  });

  it('trims the surrounding whitespace the fields were always trimmed of', () => {
    expect(normalizeAuthoredText('  padded  ')).toBe('padded');
    expect(normalizeAuthoredText('\n\nlines\n\n')).toBe('lines');
    expect(normalizeAuthoredText('')).toBe('');
    expect(normalizeAuthoredText('   ')).toBe('');
  });
});
