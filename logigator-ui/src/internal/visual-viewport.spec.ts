import { describe, expect, it } from 'vitest';
import { visualViewportRoom } from './visual-viewport';

describe('visualViewportRoom', () => {
  it('reports nothing while the visual viewport reaches the bottom edge', () => {
    expect(
      visualViewportRoom(800, { height: 800, offsetTop: 0, scale: 1 })
    ).toBeNull();
  });

  it('measures what a keyboard covers below the visual viewport', () => {
    expect(
      visualViewportRoom(800, { height: 480, offsetTop: 0, scale: 1 })
    ).toEqual({ bottomInset: 320, height: 480 });
  });

  it('puts the bottom edge at the visual viewport’s, though the browser panned it up', () => {
    expect(
      visualViewportRoom(800, { height: 480, offsetTop: 120, scale: 1 })
    ).toEqual({ bottomInset: 200, height: 480 });
  });

  it('reports nothing for a page pinch-zoomed in, which is magnified, not covered', () => {
    expect(
      visualViewportRoom(800, { height: 400, offsetTop: 0, scale: 2 })
    ).toBeNull();
  });

  it('reports nothing for a sub-pixel difference', () => {
    expect(
      visualViewportRoom(800, { height: 799.5, offsetTop: 0, scale: 1 })
    ).toBeNull();
  });
});
