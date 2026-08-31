import { Point, Rectangle } from 'pixi.js';
import { WireDirection } from '@logigator/core';

// Geometry-only DTO, so a mutation path can compare pre/post wire state
// without keeping the original Graphics instance alive.
export interface WireSnapshot {
  start: Point;
  end: Point;
  direction: WireDirection;
  gridBounds: Rectangle;
}

/**
 * Whether two snapshots are collinear with a positive-length overlap, an
 * endpoint touch not counting. This identifies an integration replacement as an
 * input wire's successor: a merge result contains the input span, a split piece
 * lies within it.
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
 * Snapshots bucketed by grid line, so "does any share a span with this one?"
 * only scans the one bucket that can match. The key is exactly what
 * {@link snapshotsShareSpan} tests before the overlap, so the answer matches a
 * full scan — which re-deriving a selection over a whole moved set would make
 * quadratic.
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
