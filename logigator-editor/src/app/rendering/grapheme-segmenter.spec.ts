import { describe, expect, it } from 'vitest';
import { CanvasTextMetrics } from 'pixi.js';
import { installAsciiGraphemeFastPath } from './grapheme-segmenter';

const intl = new Intl.Segmenter();
const reference = (s: string): string[] =>
  Array.from(intl.segment(s), (segment) => segment.segment);

describe('installAsciiGraphemeFastPath', () => {
  installAsciiGraphemeFastPath();
  const segment = (s: string) => CanvasTextMetrics.graphemeSegmenter(s);

  it('splits ASCII exactly as Intl.Segmenter does', () => {
    for (const s of ['', 'A', '&', 'Q_n', 'CLK >= 1', 'a\tb\nc', '\x00\x7f']) {
      expect(segment(s)).toEqual(reference(s));
    }
  });

  it('keeps CR LF one cluster', () => {
    expect(segment('a\r\nb')).toEqual(['a', '\r\n', 'b']);
  });

  it('keeps multi-code-point clusters whole', () => {
    // Combining mark, ZWJ family, flag, and an ASCII prefix before them.
    for (const s of ['Q̅', 'x👨‍👩‍👧', '🇩🇪', 'ä']) {
      expect(segment(s)).toEqual(reference(s));
    }
    expect(segment('Q̅')).toHaveLength(1);
    expect(segment('x👨‍👩‍👧')).toHaveLength(2);
  });
});
