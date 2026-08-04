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

/** The grid line a snapshot lies on: its direction and fixed-axis coordinate. */
function lineKey(s: WireSnapshot): string {
  return s.direction === WireDirection.HORIZONTAL
    ? `h${s.start.y}`
    : `v${s.start.x}`;
}

/**
 * Snapshots bucketed by the grid line they lie on, answering "does any of them
 * share a span with this one?" against the one bucket that can contain a match.
 * The key is exactly what {@link snapshotsShareSpan} tests before the overlap —
 * same direction, same fixed axis — so the answer is the same as a scan over
 * every snapshot, at a fraction of the comparisons. Commits that re-derive a
 * selection over a whole pasted or moved set would otherwise compare each
 * candidate against all of it, quadratic in the size of the selection.
 */
export class SnapshotSpanIndex {
  private readonly _lines = new Map<string, WireSnapshot[]>();

  constructor(snapshots: Iterable<WireSnapshot>) {
    for (const s of snapshots) {
      const key = lineKey(s);
      const line = this._lines.get(key);
      if (line) line.push(s);
      else this._lines.set(key, [s]);
    }
  }

  public sharesSpan(snap: WireSnapshot): boolean {
    const line = this._lines.get(lineKey(snap));
    if (!line) return false;
    for (const s of line) {
      if (snapshotsShareSpan(s, snap)) return true;
    }
    return false;
  }
}
