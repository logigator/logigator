import { Point, PointData } from 'pixi.js';

/**
 * Canonical string key for a grid-space point ("x,y"). Everything that matches
 * points by identity — connection-point termination counts, wire-integration
 * candidates, net extraction — relies on coordinates being lattice-exact, so
 * keys compare equal iff the coordinates are exactly equal (no rounding, no
 * epsilon). See the connection-point notes in `components/component.ts` for
 * why the producers guarantee exactness.
 */
export function pointKey(p: PointData): string {
  return `${p.x},${p.y}`;
}

/** De-duplicating set of Points keyed by {@link pointKey}. */
export class PointSet implements Iterable<Point> {
  private readonly _map = new Map<string, Point>();

  public add(p: Point): void {
    const key = pointKey(p);
    if (!this._map.has(key)) {
      this._map.set(key, p);
    }
  }

  public [Symbol.iterator](): Iterator<Point> {
    return this._map.values();
  }
}
