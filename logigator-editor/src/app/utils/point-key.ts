import { PointData } from 'pixi.js';

/**
 * Canonical string key for a grid-space point ("x,y"). Keys compare equal iff
 * the coordinates are exactly equal — no rounding, no epsilon — so every
 * consumer that matches points by identity depends on producers keeping
 * coordinates lattice-exact (see `components/component.ts`).
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
 * not retained, so entries collapse whenever two points share coordinates.
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

  // Only the "x,y" key is retained, so there is no [point, value] entry to
  // yield; iteration walks the values, mirroring PointSet.
  public [Symbol.iterator](): Iterator<V> {
    return this._map.values();
  }
}
