import { describe, expect, it } from 'vitest';
import { fitMonoFontSize, monoTextWidth } from './text-fit';

describe('monoTextWidth', () => {
  it('is glyph-count times the 0.6-em advance', () => {
    expect(monoTextWidth('A1', 10)).toBeCloseTo(12, 5);
    expect(monoTextWidth('', 10)).toBe(0);
  });
});

describe('fitMonoFontSize', () => {
  it('keeps the base size when the text fits', () => {
    // "A1" at base 8 is 9.6 wide — fits a 14-px slot.
    expect(fitMonoFontSize('A1', 14, 8, 4)).toBe(8);
  });

  it('shrinks so the text exactly fills the slot', () => {
    const size = fitMonoFontSize('CLK', 14, 8, 4);
    expect(size).toBeLessThan(8);
    expect(monoTextWidth('CLK', size)).toBeCloseTo(14, 5);
  });

  it('never goes below the minimum, accepting overflow', () => {
    const size = fitMonoFontSize('VERYLONGLABEL', 14, 8, 4);
    expect(size).toBe(4);
    expect(monoTextWidth('VERYLONGLABEL', size)).toBeGreaterThan(14);
  });

  it('returns the base for empty text', () => {
    expect(fitMonoFontSize('', 14, 8, 4)).toBe(8);
  });
});
