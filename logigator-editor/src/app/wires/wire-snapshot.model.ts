import { Point, Rectangle } from 'pixi.js';
import { WireDirection } from './wire-direction.enum';

// Geometry-only DTO independent of the live Wire object's lifetime.
// Used by mutation paths that need to compare pre/post wire state without
// keeping the original Graphics instance alive.
export interface WireSnapshot {
  start: Point;
  end: Point;
  direction: WireDirection;
  gridBounds: Rectangle;
}

/**
 * Whether two snapshots cover part of the same span — collinear with a
 * positive-length overlap, so a mere endpoint touch does not count. This is
 * what identifies an integration replacement as an input wire's successor: a
 * merge result contains the input span, a split piece lies within it.
 */
export function snapshotsShareSpan(a: WireSnapshot, b: WireSnapshot): boolean {
  if (a.direction !== b.direction) return false;
  if (a.direction === WireDirection.HORIZONTAL) {
    return (
      a.start.y === b.start.y &&
      Math.min(a.end.x, b.end.x) > Math.max(a.start.x, b.start.x)
    );
  }
  return (
    a.start.x === b.start.x &&
    Math.min(a.end.y, b.end.y) > Math.max(a.start.y, b.start.y)
  );
}
