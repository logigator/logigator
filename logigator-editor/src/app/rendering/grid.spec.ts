import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Container, Point } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Grid } from './grid';

describe('Grid chunk pool', () => {
  let grid: Grid;

  beforeEach(() => {
    configureTestBed();
    grid = new Grid();
  });

  afterEach(() => {
    grid.destroy({ children: true });
  });

  /** Chunks span 512px; a viewport of `v` covers `floor(v / 512) + 2` of them. */
  function chunksFor(size: number): number {
    return Math.floor(size / 512) + 2;
  }

  it('drops exactly one chunk when the viewport reshapes 3x3 into 4x2', () => {
    grid.resizeViewport(new Point(600, 600));
    expect(grid.children.length).toBe(9);

    // One axis grows while the other shrinks — the only way the chunk count
    // (a product of two factors >= 2) falls by exactly one, which is what a
    // device rotation does.
    grid.resizeViewport(new Point(1100, 400));

    expect(chunksFor(1100) * chunksFor(400)).toBe(8);
    expect(grid.children.length).toBe(8);
    expect(grid.children.some((child) => child.destroyed)).toBe(false);
  });

  it('destroys every chunk it drops', () => {
    grid.resizeViewport(new Point(600, 600));
    const before = [...grid.children];

    grid.resizeViewport(new Point(400, 400));

    const kept = new Set<Container>(grid.children);
    const dropped = before.filter((child) => !kept.has(child));
    expect(dropped.length).toBe(before.length - grid.children.length);
    expect(dropped.every((child) => child.destroyed)).toBe(true);
  });
});
