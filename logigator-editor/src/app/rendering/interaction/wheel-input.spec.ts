import { describe, expect, it } from 'vitest';
import {
  isPinch,
  WheelEventLike,
  wheelPixels,
  wheelScroll
} from './wheel-input';

const wheel = (fields: Partial<WheelEventLike>): WheelEventLike => ({
  clientX: 0,
  clientY: 0,
  deltaY: 0,
  preventDefault: () => undefined,
  ...fields
});

describe('isPinch', () => {
  it('reads a ctrl-wheel of small pixel deltas as a pinch', () => {
    expect(isPinch(wheel({ ctrlKey: true, deltaY: -5 }))).toBe(true);
    expect(isPinch(wheel({ ctrlKey: true, deltaY: 0.8 }))).toBe(true);
  });

  it('reads a ctrl-held mouse notch, in pixels or lines, as no pinch', () => {
    expect(isPinch(wheel({ ctrlKey: true, deltaY: 100 }))).toBe(false);
    expect(isPinch(wheel({ ctrlKey: true, deltaY: 53.333 }))).toBe(false);
    expect(isPinch(wheel({ ctrlKey: true, deltaY: 3, deltaMode: 1 }))).toBe(
      false
    );
    expect(isPinch(wheel({ deltaY: -5 }))).toBe(false);
  });
});

describe('wheelPixels', () => {
  it('converts line and page deltas to pixels', () => {
    expect(wheelPixels({ deltaMode: 0 }, 42)).toBe(42);
    expect(wheelPixels({ deltaMode: 1 }, 3)).toBeCloseTo(100, 10);
    expect(wheelPixels({ deltaMode: 2 }, 1)).toBe(800);
  });
});

describe('wheelScroll', () => {
  it('reads both axes in pixels', () => {
    expect(wheelScroll(wheel({ deltaX: 4, deltaY: -7 }))).toEqual({
      x: 4,
      y: -7
    });
    expect(wheelScroll(wheel({ deltaY: 3, deltaMode: 1 })).y).toBeCloseTo(
      100,
      10
    );
  });

  it('turns a vertical wheel sideways with shift held', () => {
    expect(wheelScroll(wheel({ shiftKey: true, deltaY: 100 }))).toEqual({
      x: 100,
      y: 0
    });
    // The browser already swapped the axes.
    expect(
      wheelScroll(wheel({ shiftKey: true, deltaX: 100, deltaY: 0 }))
    ).toEqual({ x: 100, y: 0 });
  });
});
