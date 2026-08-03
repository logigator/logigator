import { Rectangle } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { WireIntegrator } from './wire-integrator';
import { PointMap } from '../utils/point-key';
import type { Project } from './project';

/**
 * A wire-invariant violation found by {@link auditWireInvariants}. `kind`
 * mirrors the invariants in `docs/wires.md`: overlapping collinear wires (a
 * state even I1–I3 assume away), an endpoint or port inside a wire's interior
 * (I1/I2), and a collinear pair touching without a third terminator (I3).
 */
export interface WireViolation {
  kind:
    'overlap' | 'endpoint-in-interior' | 'port-in-interior' | 'unmerged-pair';
  detail: string;
}

export interface WireRepairPlan {
  /** Live tree wires whose geometry the rebuild changed — remove these. */
  removeWires: Wire[];
  /** Fresh replacement instances (never in the tree) — add these. */
  addWires: Wire[];
}

function axisPos(w: Wire): number {
  return w.direction === WireDirection.HORIZONTAL ? w.position.x : w.position.y;
}

function crossPos(w: Wire): number {
  return w.direction === WireDirection.HORIZONTAL ? w.position.y : w.position.x;
}

function interiorContains(w: Wire, p: { x: number; y: number }): boolean {
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
 * Scans the whole board for wire-invariant violations. Pure read — reports
 * without judging how the state arose, so the caller decides whether a live
 * scissor cut (a deliberate, transient I3 violation) is in play.
 */
export function auditWireInvariants(project: Project): WireViolation[] {
  const violations: WireViolation[] = [];
  const wires = [...project.wires];
  const components = [...project.components];

  // Endpoint/port termination counts, for the I3 third-terminator rule.
  const terminations = new PointMap<number>();
  const bump = (p: { x: number; y: number }): void => {
    terminations.set(p, (terminations.get(p) ?? 0) + 1);
  };
  for (const w of wires) {
    const [s, e] = w.connectionPoints;
    bump(s);
    bump(e);
  }
  for (const c of components) {
    for (const p of c.connectionPoints) bump(p);
  }

  for (const a of wires) {
    for (const b of project.queryWiresInRange(a.gridBounds)) {
      // Each unordered pair once; ids are unique.
      if (b.id <= a.id) continue;

      if (a.direction === b.direction && crossPos(a) === crossPos(b)) {
        const overlapStart = Math.max(axisPos(a), axisPos(b));
        const overlapEnd = Math.min(
          axisPos(a) + a.length,
          axisPos(b) + b.length
        );
        if (overlapStart < overlapEnd) {
          violations.push({
            kind: 'overlap',
            detail: `wires ${a.id} and ${b.id} overlap by ${overlapEnd - overlapStart} unit(s)`
          });
          continue;
        }
        if (overlapStart === overlapEnd) {
          const p =
            a.direction === WireDirection.HORIZONTAL
              ? { x: overlapStart, y: a.position.y }
              : { x: a.position.x, y: overlapStart };
          if ((terminations.get(p) ?? 0) < 3) {
            violations.push({
              kind: 'unmerged-pair',
              detail: `wires ${a.id} and ${b.id} touch at (${p.x}, ${p.y}) with no third terminator`
            });
          }
          continue;
        }
      }

      for (const [owner, other] of [
        [a, b],
        [b, a]
      ] as const) {
        for (const p of owner.connectionPoints) {
          if (interiorContains(other, p)) {
            violations.push({
              kind: 'endpoint-in-interior',
              detail: `endpoint (${p.x}, ${p.y}) of wire ${owner.id} lies inside wire ${other.id}`
            });
          }
        }
      }
    }
  }

  for (const c of components) {
    for (const p of c.connectionPoints) {
      const around = new Rectangle(p.x - 1, p.y - 1, 2, 2);
      for (const w of project.queryWiresInRange(around)) {
        if (interiorContains(w, p)) {
          violations.push({
            kind: 'port-in-interior',
            detail: `port (${p.x}, ${p.y}) of component ${c.id} lies inside wire ${w.id}`
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Spatial index over the rebuild's working set. Wires are axis-aligned and a
 * wire's gridBounds spans exactly one grid row (horizontal) or column
 * (vertical), so bucketing horizontals by row and verticals by column lets a
 * rect query touch only the buckets its rows/columns cover instead of the
 * whole set. Indexed wires must not move: the rebuild only ever adds and
 * removes instances, never repositions them.
 */
class WorkingWireIndex {
  private readonly _horizontal = new Map<number, Set<Wire>>();
  private readonly _vertical = new Map<number, Set<Wire>>();
  public readonly all = new Set<Wire>();

  private _bucketsOf(w: Wire): [Map<number, Set<Wire>>, number] {
    return w.direction === WireDirection.HORIZONTAL
      ? [this._horizontal, Math.floor(w.position.y)]
      : [this._vertical, Math.floor(w.position.x)];
  }

  public add(w: Wire): void {
    this.all.add(w);
    const [buckets, key] = this._bucketsOf(w);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = new Set()));
    bucket.add(w);
  }

  public remove(w: Wire): void {
    if (!this.all.delete(w)) return;
    const [buckets, key] = this._bucketsOf(w);
    buckets.get(key)?.delete(w);
  }

  public *query(rect: Rectangle): Generator<Wire> {
    // A horizontal wire in row r occupies gridBounds rows [r, r+1), which
    // intersects [rect.y, rect.y+rect.height) iff r > rect.y - 1 — and
    // Math.floor(rect.y) is exactly the smallest such integer. Columns mirror
    // the same bound. The per-wire intersects test stays authoritative.
    for (let row = Math.floor(rect.y); row < rect.y + rect.height; row++) {
      const bucket = this._horizontal.get(row);
      if (!bucket) continue;
      for (const w of bucket) if (w.gridBounds.intersects(rect)) yield w;
    }
    for (let col = Math.floor(rect.x); col < rect.x + rect.width; col++) {
      const bucket = this._vertical.get(col);
      if (!bucket) continue;
      for (const w of bucket) if (w.gridBounds.intersects(rect)) yield w;
    }
  }
}

/**
 * Computes the minimal wire diff that restores every invariant, without
 * touching the project. Rebuilds the board's wires in an offline working set —
 * each wire re-added through the integrator against the wires already placed,
 * exactly as if the user had drawn them one by one — so the integrator only
 * ever runs on valid state plus one wire, its designed use case. Wires whose
 * geometry survives the rebuild unchanged are matched back to their live
 * originals and stay untouched (ids, selection, history references intact);
 * only the changed remainder lands in the plan.
 */
export function computeWireRepair(project: Project): WireRepairPlan {
  const integrator = new WireIntegrator();
  const originals = [...project.wires];

  // Zero-length wires carry no span and no valid endpoints — pure cruft.
  const degenerate = originals.filter((w) => w.length === 0);

  // Deterministic processing order, independent of quad-tree iteration.
  const sorted = originals
    .filter((w) => w.length > 0)
    .sort(
      (a, b) =>
        a.direction - b.direction ||
        crossPos(a) - crossPos(b) ||
        axisPos(a) - axisPos(b) ||
        a.length - b.length ||
        a.id - b.id
    );

  const working = new WorkingWireIndex();

  for (const orig of sorted) {
    const clone = new Wire(orig.direction, orig.length);
    clone.position.copyFrom(orig.position);
    const { toAdd, toRemove } = integrator.integrate(
      { addedWires: [clone] },
      (rect) => working.query(rect),
      (rect) => project.queryComponentsInRange(rect),
      project.scale.x
    );
    for (const w of toRemove) {
      working.remove(w);
      if (!w.destroyed) w.destroy();
    }
    for (const w of toAdd) working.add(w);
    if (!toAdd.includes(clone) && !clone.destroyed) clone.destroy();
  }

  // Multiset diff by geometry: an original whose exact span survives keeps its
  // instance; everything else is replaced.
  const geometryKey = (w: Wire): string =>
    `${w.direction}:${w.position.x},${w.position.y},${w.length}`;
  const unmatched = new Map<string, Wire[]>();
  for (const w of working.all) {
    const key = geometryKey(w);
    const bucket = unmatched.get(key);
    if (bucket) bucket.push(w);
    else unmatched.set(key, [w]);
  }

  const removeWires: Wire[] = [...degenerate];
  for (const orig of sorted) {
    const bucket = unmatched.get(geometryKey(orig));
    const clone = bucket?.pop();
    if (clone) {
      clone.destroy();
    } else {
      removeWires.push(orig);
    }
  }
  const addWires = [...unmatched.values()].flat().filter((w) => !w.destroyed);

  return { removeWires, addWires };
}
