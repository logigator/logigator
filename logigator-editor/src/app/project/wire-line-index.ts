/**
 * Row/column index over a set of wires, and the axis helpers that go with it.
 *
 * A wire is axis-aligned and its `gridBounds` spans exactly one grid row
 * (horizontal) or column (vertical), so bucketing horizontals by row and
 * verticals by column puts every wire on exactly one line — and within a line,
 * ordering by axis position makes both a collinear sweep and a containment
 * lookup a binary search. The project's quad tree files by size class
 * instead, which parks long wires high in the tree where every descending
 * query rescans them; fine for the point-sized queries of an interactive
 * gesture, ruinous for a pass that touches every wire.
 *
 * Indexed wires must not move. Every caller only adds and removes instances.
 */
import { Rectangle } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';

export function axisPos(w: Wire): number {
  return w.direction === WireDirection.HORIZONTAL ? w.position.x : w.position.y;
}

export function crossPos(w: Wire): number {
  return w.direction === WireDirection.HORIZONTAL ? w.position.y : w.position.x;
}

export function interiorContains(
  w: Wire,
  p: { x: number; y: number }
): boolean {
  if (w.direction === WireDirection.HORIZONTAL) {
    return (
      p.y === w.position.y &&
      p.x > w.position.x &&
      p.x < w.position.x + w.length
    );
  }
  return (
    p.x === w.position.x && p.y > w.position.y && p.y < w.position.y + w.length
  );
}

/**
 * One grid line's wires. `sorted` (by axis position) and `maxLength` back the
 * ordered scans and are rebuilt lazily and per line, so a mutation-heavy
 * caller only re-sorts the one or two lines it touched.
 */
interface WireLine {
  readonly wires: Set<Wire>;
  sorted: Wire[] | null;
  maxLength: number;
}

/** First index in an axis-sorted line whose wire starts at or after `axis`. */
function lowerBound(sorted: readonly Wire[], axis: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (axisPos(sorted[mid]) < axis) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class WireRowColumnIndex {
  private readonly _horizontal = new Map<number, WireLine>();
  private readonly _vertical = new Map<number, WireLine>();
  public readonly all = new Set<Wire>();

  private _lineMapOf(w: Wire): [Map<number, WireLine>, number] {
    return w.direction === WireDirection.HORIZONTAL
      ? [this._horizontal, Math.floor(w.position.y)]
      : [this._vertical, Math.floor(w.position.x)];
  }

  public add(w: Wire): void {
    this.all.add(w);
    const [lines, key] = this._lineMapOf(w);
    let line = lines.get(key);
    if (!line) {
      lines.set(key, (line = { wires: new Set(), sorted: null, maxLength: 0 }));
    }
    line.wires.add(w);
    line.sorted = null;
  }

  public remove(w: Wire): void {
    if (!this.all.delete(w)) return;
    const [lines, key] = this._lineMapOf(w);
    const line = lines.get(key);
    if (!line) return;
    line.wires.delete(w);
    line.sorted = null;
  }

  public *query(rect: Rectangle): Generator<Wire> {
    // A horizontal wire in row r occupies gridBounds rows [r, r+1), which
    // intersects [rect.y, rect.y+rect.height) iff r > rect.y - 1 — and
    // Math.floor(rect.y) is exactly the smallest such integer. Columns mirror
    // the same bound.
    for (let row = Math.floor(rect.y); row < rect.y + rect.height; row++) {
      const line = this._horizontal.get(row);
      if (line) yield* this._span(line, rect.x, rect.x + rect.width, rect);
    }
    for (let col = Math.floor(rect.x); col < rect.x + rect.width; col++) {
      const line = this._vertical.get(col);
      if (line) yield* this._span(line, rect.y, rect.y + rect.height, rect);
    }
  }

  /**
   * The wires of one line that can reach `[from, to)` along its axis, in axis
   * order. Both ends are binary-searched — a line holds every wire on its grid
   * row or column, which on a wide board is far more than any one query wants.
   * The bounds are deliberately loose (a wire's gridBounds origin is its
   * floored position, and it extends `length + 1`); `intersectsGridBounds`
   * stays the authoritative test.
   */
  private *_span(
    line: WireLine,
    from: number,
    to: number,
    rect: Rectangle
  ): Generator<Wire> {
    const sorted = this._sortedOf(line);
    const first = lowerBound(sorted, from - line.maxLength - 1);
    const end = lowerBound(sorted, to + 1);
    for (let i = first; i < end; i++) {
      if (sorted[i].intersectsGridBounds(rect)) yield sorted[i];
    }
  }

  /**
   * Every grid line's wires, each sorted by axis position. Two wires can only
   * be collinear if they share a line, so a whole-board collinear scan is a
   * walk over these instead of a query per wire.
   */
  public *lines(): Generator<Wire[]> {
    for (const line of this._horizontal.values()) yield this._sortedOf(line);
    for (const line of this._vertical.values()) yield this._sortedOf(line);
  }

  /**
   * Calls `visit` for every wire whose interior contains `p`. An interior
   * point lies exactly on its wire's centre line, so only the row and the
   * column through `p` can hold one — and within a line the wires are ordered,
   * so this binary-searches rather than scanning the line.
   */
  public forEachInteriorContaining(
    p: { x: number; y: number },
    visit: (w: Wire) => void
  ): void {
    this._scanLine(this._horizontal.get(Math.floor(p.y)), p.x, p, visit);
    this._scanLine(this._vertical.get(Math.floor(p.x)), p.y, p, visit);
  }

  private _sortedOf(line: WireLine): Wire[] {
    if (!line.sorted) {
      line.sorted = [...line.wires].sort(
        (a, b) => axisPos(a) - axisPos(b) || a.id - b.id
      );
      line.maxLength = 0;
      for (const w of line.sorted) {
        if (w.length > line.maxLength) line.maxLength = w.length;
      }
    }
    return line.sorted;
  }

  private _scanLine(
    line: WireLine | undefined,
    q: number,
    p: { x: number; y: number },
    visit: (w: Wire) => void
  ): void {
    if (!line) return;
    const sorted = this._sortedOf(line);

    // A wire containing q in its interior starts strictly before it, so binary
    // search for the first wire at or after q and walk back from there. It also
    // has to reach q, which no wire starting further back than the line's
    // longest can — that bounds the walk.
    const end = lowerBound(sorted, q);
    const reach = q - line.maxLength;
    for (let i = end - 1; i >= 0 && axisPos(sorted[i]) > reach; i--) {
      if (interiorContains(sorted[i], p)) visit(sorted[i]);
    }
  }
}
