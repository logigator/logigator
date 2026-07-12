import { describe, expect, it } from 'vitest';
import { Rectangle } from 'pixi.js';
import { fitRegion, mapViewportRect, nextFrame } from './minimap-frame';

describe('fitRegion', () => {
  it('fits a wider-than-panel region by width and centers vertically', () => {
    const fit = fitRegion(new Rectangle(0, 0, 100, 25), 200, 150);
    expect(fit.scale).toBe(2);
    expect(fit.offsetX).toBe(0);
    expect(fit.offsetY).toBe((150 - 25 * 2) / 2);
  });

  it('fits a taller-than-panel region by height and centers horizontally', () => {
    const fit = fitRegion(new Rectangle(0, 0, 10, 30), 200, 150);
    expect(fit.scale).toBe(5);
    expect(fit.offsetX).toBe((200 - 10 * 5) / 2);
    expect(fit.offsetY).toBe(0);
  });
});

describe('nextFrame', () => {
  it('frames a first region with slack on every side', () => {
    const frame = nextFrame(null, new Rectangle(0, 0, 100, 50));
    expect(frame.x).toBeLessThan(0);
    expect(frame.y).toBeLessThan(0);
    expect(frame.containsRect(new Rectangle(0, 0, 100, 50))).toBe(true);
    // Slack = 10% of the larger dimension.
    expect(frame.x).toBe(-10);
    expect(frame.width).toBe(120);
  });

  it('applies a minimum slack to tiny regions', () => {
    const frame = nextFrame(null, new Rectangle(0, 0, 4, 4));
    expect(frame.x).toBe(-2);
    expect(frame.width).toBe(8);
  });

  it('keeps the frame while the region still fits inside it', () => {
    const current = nextFrame(null, new Rectangle(0, 0, 100, 50));
    const grown = new Rectangle(0, 0, 105, 55);
    expect(nextFrame(current, grown)).toBe(current);
  });

  it('re-frames once content escapes the frame', () => {
    const current = nextFrame(null, new Rectangle(0, 0, 100, 50));
    const escaped = new Rectangle(0, 0, 130, 50);
    const next = nextFrame(current, escaped);
    expect(next).not.toBe(current);
    expect(next.containsRect(escaped)).toBe(true);
  });

  it('re-frames when content shrinks below half the frame area', () => {
    const current = nextFrame(null, new Rectangle(0, 0, 100, 100));
    const shrunk = new Rectangle(40, 40, 20, 20);
    const next = nextFrame(current, shrunk);
    expect(next).not.toBe(current);
    expect(next.containsRect(shrunk)).toBe(true);
  });
});

describe('mapViewportRect', () => {
  const frame = new Rectangle(0, 0, 100, 75);
  const fit = fitRegion(frame, 200, 150); // scale 2, no offsets

  it('maps a fully visible viewport 1:1 through the fit', () => {
    const rect = mapViewportRect(
      { x: 10, y: 5 },
      { x: 30, y: 20 },
      frame,
      fit,
      200,
      150,
      8
    );
    expect(rect).toEqual({ x: 20, y: 10, width: 60, height: 40 });
  });

  it('clips at the panel edge when the camera sits outside the frame', () => {
    const rect = mapViewportRect(
      { x: -20, y: 0 },
      { x: 30, y: 20 },
      frame,
      fit,
      200,
      150,
      8
    );
    expect(rect.x).toBe(0);
    expect(rect.width).toBe(20); // only the overlapping 10 grid units remain
  });

  it('pins an edge-hugging marker when the viewport is entirely off-map', () => {
    const rect = mapViewportRect(
      { x: -500, y: -500 },
      { x: 30, y: 20 },
      frame,
      fit,
      200,
      150,
      8
    );
    expect(rect).toEqual({ x: 0, y: 0, width: 8, height: 8 });
  });

  it('enforces the minimum size at deep zoom and stays inside the panel', () => {
    const rect = mapViewportRect(
      { x: 99, y: 74 },
      { x: 1, y: 0.5 },
      frame,
      fit,
      200,
      150,
      8
    );
    expect(rect.width).toBe(8);
    expect(rect.height).toBe(8);
    expect(rect.x + rect.width).toBeLessThanOrEqual(200);
    expect(rect.y + rect.height).toBeLessThanOrEqual(150);
  });

  it('caps an over-zoomed-out viewport at the panel size', () => {
    const rect = mapViewportRect(
      { x: -100, y: -100 },
      { x: 400, y: 400 },
      frame,
      fit,
      200,
      150,
      8
    );
    expect(rect).toEqual({ x: 0, y: 0, width: 200, height: 150 });
  });
});
