import { describe, expect, it } from 'vitest';
import { Point, Rectangle } from 'pixi.js';
import { Direction } from '@logigator/core';
import {
  normalizeRotationSteps,
  rotateDirection,
  rotatePointAroundPivot,
  rotateRectAroundPivot,
  rotationPivotFor
} from './rotation';

describe('rotation helpers', () => {
  it('normalizes step counts into 0..3', () => {
    expect(normalizeRotationSteps(0)).toBe(0);
    expect(normalizeRotationSteps(5)).toBe(1);
    expect(normalizeRotationSteps(-1)).toBe(3);
    expect(normalizeRotationSteps(4)).toBe(0);
  });

  it('cycles directions clockwise E → S → W → N', () => {
    expect(rotateDirection(Direction.E, 1)).toBe(Direction.S);
    expect(rotateDirection(Direction.S, 1)).toBe(Direction.W);
    expect(rotateDirection(Direction.W, 1)).toBe(Direction.N);
    expect(rotateDirection(Direction.N, 1)).toBe(Direction.E);
    expect(rotateDirection(Direction.E, 3)).toBe(Direction.N);
  });

  it('one clockwise turn maps an offset (dx, dy) to (-dy, dx)', () => {
    const pivot = new Point(3, 2);
    // (5, 2) is +2 in x from the pivot → lands +2 in y.
    expect(rotatePointAroundPivot(pivot, new Point(5, 2), 1)).toEqual(
      new Point(3, 4)
    );
  });

  it('rotating a point four times in single steps returns it exactly', () => {
    const pivot = new Point(7, -3);
    let p = new Point(1234.5, -0.5);
    for (let i = 0; i < 4; i++) {
      p = rotatePointAroundPivot(pivot, p, 1);
    }
    expect(p).toEqual(new Point(1234.5, -0.5));
  });

  it('keeps half-grid points on the half-grid around an integer pivot', () => {
    const pivot = new Point(4, 9);
    for (let steps = 1; steps <= 3; steps++) {
      const rotated = rotatePointAroundPivot(
        pivot,
        new Point(12.5, -3.5),
        steps
      );
      expect(rotated.x - Math.floor(rotated.x)).toBe(0.5);
      expect(rotated.y - Math.floor(rotated.y)).toBe(0.5);
    }
  });

  it('CW and CCW around the same pivot are inverses', () => {
    const pivot = new Point(2, 5);
    const p = new Point(-4.5, 11);
    const there = rotatePointAroundPivot(pivot, p, 1);
    expect(rotatePointAroundPivot(pivot, there, 3)).toEqual(p);
  });

  it('rotates an axis-aligned rect to an axis-aligned rect with swapped extent', () => {
    const pivot = new Point(0, 0);
    const rect = new Rectangle(1, 2, 4, 2);
    const turned = rotateRectAroundPivot(pivot, rect, 1);
    // Corners (1,2) and (5,4) orbit to (-2,1) and (-4,5).
    expect(turned).toEqual(new Rectangle(-4, 1, 2, 4));
    // A full cycle returns the original.
    expect(rotateRectAroundPivot(pivot, turned, 3)).toEqual(rect);
  });

  describe('rotationPivotFor', () => {
    // Every half-grid bounds shape and offset up to 4x4 — covers all centre
    // fraction classes (0, 1/4, 1/2, 3/4 per axis), negatives included.
    function* halfGridBounds(): Generator<Rectangle> {
      for (let x2 = -5; x2 <= 5; x2++)
        for (let y2 = -5; y2 <= 5; y2++)
          for (let w2 = 1; w2 <= 8; w2++)
            for (let h2 = 1; h2 <= 8; h2++)
              yield new Rectangle(x2 / 2, y2 / 2, w2 / 2, h2 / 2);
    }

    it('stays on the rotation-safe lattice, within half a unit of the centre', () => {
      for (const bounds of halfGridBounds()) {
        const pivot = rotationPivotFor(bounds);
        const bothInt = Number.isInteger(pivot.x) && Number.isInteger(pivot.y);
        const bothHalf =
          Number.isInteger(pivot.x - 0.5) && Number.isInteger(pivot.y - 0.5);
        expect(bothInt || bothHalf).toBe(true);
        expect(
          Math.abs(pivot.x - (bounds.x + bounds.width / 2))
        ).toBeLessThanOrEqual(0.5);
        expect(
          Math.abs(pivot.y - (bounds.y + bounds.height / 2))
        ).toBeLessThanOrEqual(0.5);
      }
    });

    it('is a fixed point of the rotation step, so re-derived pivots never drift', () => {
      // Recomputing the pivot from the turned bounds must yield the same
      // point in both directions — this is what makes independent
      // quarter-turn presses compose into an exact full turn.
      for (const bounds of halfGridBounds()) {
        const pivot = rotationPivotFor(bounds);
        for (const steps of [1, 3]) {
          const turned = rotateRectAroundPivot(pivot, bounds, steps);
          expect(rotationPivotFor(turned)).toEqual(pivot);
        }
      }
    });
  });
});
