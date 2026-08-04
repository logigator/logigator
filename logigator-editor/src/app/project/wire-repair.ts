import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { WireIntegrator } from './wire-integrator';
import { PointMap } from '../utils/point-key';
import { axisPos, crossPos, WireRowColumnIndex } from './wire-line-index';
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

/**
 * Scans the whole board for wire-invariant violations. Pure read — reports
 * without judging how the state arose, so the caller decides whether a live
 * scissor cut (a deliberate, transient I3 violation) is in play.
 *
 * Runs off a {@link WireRowColumnIndex} built here rather than the project's
 * quad tree, and never issues a rect query: collinear pairs are a sorted sweep
 * within each grid line, and a buried endpoint or port is a lookup of the two
 * lines through that point. Both are bounded by what shares a line with the
 * wire, so a whole-board scan stays independent of how long the wires are.
 */
export function auditWireInvariants(project: Project): WireViolation[] {
  const violations: WireViolation[] = [];
  const wires = [...project.wires];
  const components = [...project.components];

  const index = new WireRowColumnIndex();
  for (const w of wires) index.add(w);

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

  // Collinear pairs (overlap, I3) — a line sweep per bucket. Sorting by axis
  // position means each wire only meets the ones that start before it ends;
  // everything after that is out of reach, so the scan stops.
  for (const sorted of index.lines()) {
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const aEnd = axisPos(a) + a.length;
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (axisPos(b) > aEnd) break;
        // A bucket is one grid line, but its key is the floored coordinate —
        // an off-lattice wire could share it without being collinear.
        if (crossPos(a) !== crossPos(b)) continue;

        // Ids in the message stay low-first, independent of the sweep order.
        const [lo, hi] = a.id < b.id ? [a, b] : [b, a];
        const overlapEnd = Math.min(aEnd, axisPos(b) + b.length);
        if (axisPos(b) < overlapEnd) {
          violations.push({
            kind: 'overlap',
            detail: `wires ${lo.id} and ${hi.id} overlap by ${overlapEnd - axisPos(b)} unit(s)`
          });
        } else if (axisPos(b) === overlapEnd) {
          const p =
            a.direction === WireDirection.HORIZONTAL
              ? { x: axisPos(b), y: a.position.y }
              : { x: a.position.x, y: axisPos(b) };
          if ((terminations.get(p) ?? 0) < 3) {
            violations.push({
              kind: 'unmerged-pair',
              detail: `wires ${lo.id} and ${hi.id} touch at (${p.x}, ${p.y}) with no third terminator`
            });
          }
        }
      }
    }
  }

  // I1/I2 — an endpoint or a port buried in some wire's interior. An interior
  // point sits exactly on its wire's centre line, so only the row and column
  // through the point can hold one: a point lookup, never a span query. This is
  // what keeps a long bus from dragging in every wire it crosses.
  for (const a of wires) {
    for (const p of a.connectionPoints) {
      index.forEachInteriorContaining(p, (other) => {
        // Collinear neighbours (including `a` itself) are the overlap/merge
        // case the sweep above already classified.
        if (other.direction === a.direction && crossPos(other) === crossPos(a))
          return;
        violations.push({
          kind: 'endpoint-in-interior',
          detail: `endpoint (${p.x}, ${p.y}) of wire ${a.id} lies inside wire ${other.id}`
        });
      });
    }
  }

  for (const c of components) {
    for (const p of c.connectionPoints) {
      index.forEachInteriorContaining(p, (w) => {
        violations.push({
          kind: 'port-in-interior',
          detail: `port (${p.x}, ${p.y}) of component ${c.id} lies inside wire ${w.id}`
        });
      });
    }
  }

  return violations;
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

  const working = new WireRowColumnIndex();

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
