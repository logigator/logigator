import { describe, expect, it } from 'vitest';
import { Point } from 'pixi.js';
import { environment } from '../../../environments/environment';
import { canvasToGrid } from './pointer-input';

const gs = environment.gridSize;

describe('canvasToGrid', () => {
  it('maps canvas pixels to grid units at scale 1, origin 0', () => {
    const viewport = { position: new Point(0, 0), scale: new Point(1, 1) };
    const grid = canvasToGrid(viewport, new Point(3 * gs, 5 * gs));
    expect(grid).toMatchObject({ x: 3, y: 5 });
  });

  it('subtracts the viewport pan offset before scaling', () => {
    const viewport = {
      position: new Point(2 * gs, -gs),
      scale: new Point(1, 1)
    };
    const grid = canvasToGrid(viewport, new Point(2 * gs, 0));
    expect(grid).toMatchObject({ x: 0, y: 1 });
  });

  it('divides by the zoom factor', () => {
    const viewport = { position: new Point(0, 0), scale: new Point(0.5, 0.5) };
    const grid = canvasToGrid(viewport, new Point(4 * gs, 4 * gs));
    expect(grid).toMatchObject({ x: 8, y: 8 });
  });

  it('combines pan and zoom (a zoomed, panned viewport)', () => {
    const viewport = { position: new Point(10, 20), scale: new Point(2, 2) };
    const grid = canvasToGrid(viewport, new Point(10 + 6 * gs, 20 + 2 * gs));
    expect(grid).toMatchObject({ x: 3, y: 1 });
  });
});
