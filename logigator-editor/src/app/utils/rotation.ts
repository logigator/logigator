import { Point, PointData, Rectangle } from 'pixi.js';
import { Direction } from './direction';

/**
 * Pure quarter-turn helpers for rotating a group of circuit elements around a
 * shared pivot. Like `component-geometry.ts`, rotation here is exact
 * per-step arithmetic, never a trig Matrix: connection points are matched by
 * exact coordinates, so any float noise would disconnect ports that still
 * look attached.
 *
 * `steps` counts clockwise quarter-turns; a counter-clockwise turn is 3.
 */

/** Reduces any step count to the 0..3 range (negatives allowed). */
export function normalizeRotationSteps(steps: number): number {
  return ((steps % 4) + 4) % 4;
}

/** A direction turned clockwise by `steps` quarter-turns. */
export function rotateDirection(
  direction: Direction,
  steps: number
): Direction {
  return ((direction + normalizeRotationSteps(steps)) % 4) as Direction;
}

/**
 * A point rotated clockwise around `pivot` by `steps` quarter-turns. One
 * clockwise turn maps an offset (dx, dy) to (-dy, dx) — the same matrix as
 * `rotatedLocalPoint`'s E→S step.
 */
export function rotatePointAroundPivot(
  pivot: PointData,
  p: PointData,
  steps: number
): Point {
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  switch (normalizeRotationSteps(steps)) {
    case 0:
      return new Point(p.x, p.y);
    case 1:
      return new Point(pivot.x - dy, pivot.y + dx);
    case 2:
      return new Point(pivot.x - dx, pivot.y - dy);
    default:
      return new Point(pivot.x + dy, pivot.y - dx);
  }
}

/**
 * An axis-aligned rectangle rotated around `pivot` — quarter-turns keep it
 * axis-aligned (width and height swap on odd steps).
 */
export function rotateRectAroundPivot(
  pivot: PointData,
  rect: Rectangle,
  steps: number
): Rectangle {
  const a = rotatePointAroundPivot(pivot, { x: rect.x, y: rect.y }, steps);
  const b = rotatePointAroundPivot(
    pivot,
    { x: rect.right, y: rect.bottom },
    steps
  );
  return new Rectangle(
    Math.min(a.x, b.x),
    Math.min(a.y, b.y),
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y)
  );
}

/**
 * The pivot a group rotates around: its bounding box's centre snapped to the
 * integer grid. An integer pivot maps integer component positions back onto
 * integers and half-grid wire endpoints back onto the half-grid (the rotated
 * coordinates are pivot-sums of the source offsets); a pivot with a
 * fractional part on only one axis would shear the two lattices into each
 * other. The choice only affects where the group lands, never its internal
 * geometry.
 */
export function rotationPivotFor(bounds: Rectangle): Point {
  return new Point(
    Math.round(bounds.x + bounds.width / 2),
    Math.round(bounds.y + bounds.height / 2)
  );
}
