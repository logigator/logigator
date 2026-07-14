import { Point, PointData, Rectangle } from 'pixi.js';
import { Direction } from '../utils/direction';
import type { PortSide } from './component';

/**
 * Pure component geometry: port positions, rotated bounds and anchors derived
 * from a plain shape descriptor — no PixiJS containers involved, so the
 * lattice invariants below are unit-testable on their own.
 *
 * Connection points must land exactly on the half-grid lattice: wires, the
 * net extractor, and the connection-point manager all match termination
 * points by exact coordinates (see `utils/point-key.ts`), so any drift
 * disconnects the port logically while it still looks attached. Two
 * consequences here:
 *   - Ports sit at the nominal stub tips, never at rendered bounds: the body
 *     stroke is screen-constant, so its grid-space extent grows as the zoom
 *     shrinks and below ~18% zoom it pokes past the stub tip.
 *   - Rotation is exact per-direction arithmetic, never a trig Matrix:
 *     cos/sin of the quarter-turns carry ~1e-16 noise that survives the final
 *     addition for components near the origin.
 */
export interface ComponentShape {
  direction: Direction;
  numInputs: number;
  numOutputs: number;
  /** Body extent (grid units) in the unrotated local frame. */
  bodyGridWidth: number;
  bodyGridHeight: number;
  /** The component's grid-space position (its rotation pivot). */
  position: PointData;
}

/** Rotates an unrotated-frame local point by a direction (exact arithmetic). */
export function rotatedLocalPoint(
  direction: Direction,
  lx: number,
  ly: number
): Point {
  switch (direction) {
    case Direction.E:
      return new Point(lx, ly);
    case Direction.S:
      return new Point(-ly, lx);
    case Direction.W:
      return new Point(-lx, -ly);
    case Direction.N:
      return new Point(ly, -lx);
  }
}

/**
 * AABB in parent (gridSpace) coordinates of an unrotated local box
 * [x0, x1] × [y0, y1], rotated to `direction` around `position`.
 */
export function rotatedBox(
  direction: Direction,
  position: PointData,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Rectangle {
  const x = position.x;
  const y = position.y;
  const w = x1 - x0;
  const h = y1 - y0;

  switch (direction) {
    case Direction.E:
      return new Rectangle(x + x0, y + y0, w, h);
    case Direction.S:
      return new Rectangle(x - y1, y + x0, h, w);
    case Direction.W:
      return new Rectangle(x - x1, y - y1, w, h);
    case Direction.N:
      return new Rectangle(x + y0, y - x1, h, w);
  }
}

/**
 * Port positions in the component's local (parent-relative, unpositioned)
 * frame: inputs at the left stub tips, outputs past the body's right edge,
 * both rotated to the shape's direction. Order: inputs, then outputs.
 */
export function localConnectionPoints(shape: ComponentShape): Point[] {
  const points: Point[] = [];

  for (let i = 0; i < shape.numInputs; i++) {
    points.push(rotatedLocalPoint(shape.direction, -0.5, i + 0.5));
  }
  for (let i = 0; i < shape.numOutputs; i++) {
    points.push(
      rotatedLocalPoint(shape.direction, shape.bodyGridWidth + 0.5, i + 0.5)
    );
  }

  return points;
}

/** Port positions in grid space (local points offset by the position). */
export function connectionPoints(shape: ComponentShape): Point[] {
  return localConnectionPoints(shape).map(
    (p) => new Point(shape.position.x + p.x, shape.position.y + p.y)
  );
}

/** The body's AABB in grid space (no stubs). */
export function bodyGridBounds(shape: ComponentShape): Rectangle {
  return rotatedBox(
    shape.direction,
    shape.position,
    0,
    0,
    shape.bodyGridWidth,
    shape.bodyGridHeight
  );
}

/**
 * The full logical AABB in grid space: the body plus the half-grid stub
 * extents on each side that has ports. Stubs are horizontal in the local
 * frame, so they never extend the local y extent.
 */
export function gridBounds(shape: ComponentShape): Rectangle {
  const lx = shape.numInputs > 0 ? -0.5 : 0;
  const x1 = shape.bodyGridWidth + (shape.numOutputs > 0 ? 0.5 : 0);
  return rotatedBox(
    shape.direction,
    shape.position,
    lx,
    0,
    x1,
    shape.bodyGridHeight
  );
}

/**
 * Grid-space body-edge point where the inverter bubble for a port (0-based
 * within its group) is pinned — the bubble's tangent point, from which it
 * grows outward along the stub. Mirrors the bubble placement in the drawn
 * connections so the port-negation tool's hover preview lands exactly on the
 * real bubble's spot.
 */
export function negationBubbleAnchor(
  shape: ComponentShape,
  side: PortSide,
  index: number
): Point {
  const local =
    side === 'in'
      ? rotatedLocalPoint(shape.direction, 0, index + 0.5)
      : rotatedLocalPoint(shape.direction, shape.bodyGridWidth, index + 0.5);
  return new Point(shape.position.x + local.x, shape.position.y + local.y);
}
