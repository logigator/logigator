import { Point, PointData, Rectangle } from 'pixi.js';
import { Direction } from '@logigator/core';

/**
 * Pure quarter-turn helpers for rotating a group of circuit elements around a
 * shared pivot. Exact per-step arithmetic, never a trig Matrix: connection
 * points are matched by exact coordinates, so float noise would disconnect
 * ports that still look attached.
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

/** A point rotated clockwise around `pivot` by `steps` quarter-turns. */
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
 * An axis-aligned rectangle rotated around `pivot`; quarter-turns keep it
 * axis-aligned, with width and height swapping on odd steps.
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
 * nearest rotation-safe lattice point. Safe means both coordinates integer or
 * both half-odd, which keeps integer component positions on integers and
 * half-grid wire endpoints on the half-grid; a fractional part on one axis
 * only would shear the two lattices into each other.
 *
 * The snap is a fixed point of the rotation step, so repeated quarter-turns
 * share one exact pivot and any sequence netting out to full turns lands the
 * group where it started. That needs unbiased tie-breaks — a half-up tie like
 * `Math.round`'s translates the group a little every step and never cancels:
 *
 * - Integer vs half-odd at equal distance: the integer point wins.
 * - Centre halfway between two integer points: the even x + y point wins, so
 *   every position the group orbits through picks the same endpoint.
 *
 * Bounds live on the half-grid, so centre coordinates are multiples of 1/4 —
 * dyadic and exact.
 */
export function rotationPivotFor(bounds: Rectangle): Point {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  // Integer candidate. On a half tie parity picks between the half-up
  // rounding and its lower neighbour. `+ 0` folds away negative zero.
  let ix = Math.round(cx) + 0;
  let iy = Math.round(cy) + 0;
  if ((ix + iy) % 2 !== 0) {
    if (cx - Math.floor(cx) === 0.5) ix--;
    else if (cy - Math.floor(cy) === 0.5) iy--;
  }

  // Half-odd candidate: unique whenever it is strictly nearer than the
  // integer one, so its own rounding ties never surface.
  const hx = Math.round(cx - 0.5) + 0.5;
  const hy = Math.round(cy - 0.5) + 0.5;

  const intDist = (cx - ix) ** 2 + (cy - iy) ** 2;
  const halfDist = (cx - hx) ** 2 + (cy - hy) ** 2;
  return halfDist < intDist ? new Point(hx, hy) : new Point(ix, iy);
}
