import { PointData } from 'pixi.js';

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
export class PointSet<T extends PointData> implements Iterable<T> {
  private readonly _map = new Map<string, T>();

  public add(p: T): void {
    const key = pointKey(p);
    if (!this._map.has(key)) {
      this._map.set(key, p);
    }
  }

  public [Symbol.iterator](): Iterator<T> {
    return this._map.values();
  }
}

/**
 * Map from grid-space points to values, keyed by {@link pointKey}. The point is
 * only a lookup key — it is not retained — so entries collapse whenever two
 * points share coordinates, exactly like the keys compare in {@link pointKey}.
 */
export class PointMap<V> implements Iterable<V> {
  private readonly _map = new Map<string, V>();

  public get(p: PointData): V | undefined {
    return this._map.get(pointKey(p));
  }

  public set(p: PointData, value: V): void {
    this._map.set(pointKey(p), value);
  }

  public has(p: PointData): boolean {
    return this._map.has(pointKey(p));
  }

  public delete(p: PointData): boolean {
    return this._map.delete(pointKey(p));
  }

  public clear(): void {
    this._map.clear();
  }

  // Points are not retained (only their "x,y" key), so there is no meaningful
  // [point, value] entry to yield — iteration walks the values, mirroring PointSet.
  public [Symbol.iterator](): Iterator<V> {
    return this._map.values();
  }
}
