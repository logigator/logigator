import { environment } from '../../environments/environment';
import { Point, PointData, Rectangle } from 'pixi.js';

// One physical pixel expressed in grid-unit space.
export const PX = 1 / environment.gridSize;

export function fromGrid(val: number): number {
  return val * environment.gridSize;
}

export function roundToGrid(point: Point, inline = false): Point {
  if (inline) {
    return point.set(Math.round(point.x), Math.round(point.y));
  }
  return new Point(Math.round(point.x), Math.round(point.y));
}

/**
 * A rectangle translated by an offset — the grid-space bounds of a drag-layer
 * element as seen by the project (element bounds + the layer's drag offset).
 */
export function offsetRect(bounds: Rectangle, offset: PointData): Rectangle {
  return new Rectangle(
    bounds.x + offset.x,
    bounds.y + offset.y,
    bounds.width,
    bounds.height
  );
}

/**
 * Whether `rect` overlaps the AABB given as loose scalars. Matches
 * `Rectangle.intersects` exactly — edge contact is not an overlap — but takes
 * the second box unmaterialized, so callers that derive their bounds on the fly
 * can test without allocating a Rectangle. Backs
 * {@link GridElement.intersectsGridBounds}, which runs once per candidate on
 * every quad-tree query.
 */
export function overlapsRect(
  rect: Rectangle,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const left = rect.x < x ? x : rect.x;
  const rectRight = rect.x + rect.width;
  const boxRight = x + width;
  const right = rectRight > boxRight ? boxRight : rectRight;
  if (right <= left) return false;

  const top = rect.y < y ? y : rect.y;
  const rectBottom = rect.y + rect.height;
  const boxBottom = y + height;
  const bottom = rectBottom > boxBottom ? boxBottom : rectBottom;
  return bottom > top;
}

export function roundToHalfGrid(point: Point, inline = false): Point {
  const r = (n: number) => Math.floor(n) + 0.5;
  if (inline) {
    return point.set(r(point.x), r(point.y));
  }
  return new Point(r(point.x), r(point.y));
}
