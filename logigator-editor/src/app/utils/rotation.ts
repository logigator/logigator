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
 * nearest rotation-safe lattice point. Safe points have both coordinates
 * integer or both half-odd — either kind maps integer component positions
 * back onto integers and half-grid wire endpoints back onto the half-grid
 * (the rotated coordinates are pivot-sums of the source offsets); a point
 * with a fractional part on only one axis would shear the two lattices into
 * each other.
 *
 * The snap is a fixed point of the rotation step: recomputing the pivot from
 * the rotated bounds yields the same point, so repeated quarter-turns — each
 * an independent rotate committing in place — share one exact pivot, and any
 * sequence netting out to full turns lands the group exactly where it
 * started. That property hinges on two deterministic tie-breaks (a
 * direction-biased tie like `Math.round`'s half-up translates the group a
 * little each step, and the bias never cancels across a cycle):
 *
 * - Integer vs half-odd at equal distance (centre fractions of ±1/4 on both
 *   axes): the integer point wins.
 * - Centre halfway between two integer points (fraction 1/2 on exactly one
 *   axis): the point with even x + y wins. Such centres are edge midpoints
 *   of the integer grid; every position the group orbits through resolves
 *   to the same even-sum endpoint.
 *
 * Bounds live on the half-grid, so centre coordinates are multiples of 1/4 —
 * dyadic and exact, like all lattice arithmetic in this file.
 */
export function rotationPivotFor(bounds: Rectangle): Point {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  // Integer candidate. On a half tie the two nearest integers are the
  // half-up rounding and its lower neighbour; parity picks between them.
  // `+ 0` folds Math.round's negative zero into plain zero.
  let ix = Math.round(cx) + 0;
  let iy = Math.round(cy) + 0;
  if ((ix + iy) % 2 !== 0) {
    if (cx - Math.floor(cx) === 0.5) ix--;
    else if (cy - Math.floor(cy) === 0.5) iy--;
  }

  // Half-odd candidate. Whenever it is strictly nearer than the integer one
  // it is also unique, so its own rounding ties never surface.
  const hx = Math.round(cx - 0.5) + 0.5;
  const hy = Math.round(cy - 0.5) + 0.5;

  const intDist = (cx - ix) ** 2 + (cy - iy) ** 2;
  const halfDist = (cx - hx) ** 2 + (cy - hy) ** 2;
  return halfDist < intDist ? new Point(hx, hy) : new Point(ix, iy);
}
