import { Point, Rectangle } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireDirection } from '@logigator/core';
import { WireSnapshot } from '../wires/wire-snapshot.model';
import type { Component } from '../components/component';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';
import { pointKey } from '../utils/point-key';
import { axisPos, WireRowColumnIndex } from './wire-line-index';

export interface MovedWireEntry {
  wire: Wire;
  oldSnapshot: WireSnapshot;
}

export interface MovedComponentPortsEntry {
  oldPorts: readonly Point[];
  newPorts: readonly Point[];
}

export interface IntegrationInput {
  // Live wire instances not yet in the project tree.
  addedWires?: readonly Wire[];
  // Live wire instances currently in the project tree, about to be removed.
  removedWires?: readonly Wire[];
  // Already at their new positions in the project tree; oldSnapshot seeds
  // candidate points at the pre-move geometry.
  movedWires?: readonly MovedWireEntry[];
  // Ports of a component about to be added (not yet in the project).
  addedComponentPorts?: readonly Point[];
  // Ports of a component currently in the project, about to be removed.
  removedComponentPorts?: readonly Point[];
  // Already at their new positions, so queries return newPorts; oldPorts is
  // only needed to mark candidates.
  movedComponentPorts?: readonly MovedComponentPortsEntry[];
  // Terminations of elements already gone from the tree (the eraser deletes
  // live during its sweep). Seeds candidates so the merge pass heals a
  // collinear pair whose third terminator vanished; the split pass's
  // termination guard stops a vacated point from splitting anything.
  vacatedPoints?: readonly Point[];
}

export interface IntegrationOutput {
  // To add: split/merge results plus addedWires that survived integration.
  toAdd: Wire[];
  // To remove from the tree: absorbed by a merge, or split into pieces.
  toRemove: Wire[];
}

// Integration converges in 1–2 passes, so hitting the cap means a bug — throw
// rather than silently emit the wrong thing.
const MAX_ITERATIONS = 8;

export class WireIntegrator {
  integrate(
    input: IntegrationInput,
    // Iterable, not Generator: the project hands back arrays, the offline
    // rebuild hands back the line index's generator.
    queryWiresInRange: (rect: Rectangle) => Iterable<Wire>,
    queryComponentsInRange: (rect: Rectangle) => Iterable<Component>,
    scale: number
  ): IntegrationOutput {
    const addedWires = input.addedWires ?? [];
    const removedWires = input.removedWires ?? [];
    const movedWires = input.movedWires ?? [];
    const addedComponentPorts = input.addedComponentPorts ?? [];
    const removedComponentPorts = input.removedComponentPorts ?? [];
    const movedComponentPorts = input.movedComponentPorts ?? [];
    const vacatedPoints = input.vacatedPoints ?? [];

    const candidates = new Map<string, Point>();
    const addCandidate = (p: Point) => {
      const k = pointKey(p);
      if (!candidates.has(k)) candidates.set(k, p.clone());
    };

    // Live to the caller but not yet in the project tree: addedWires plus the
    // split/merge results. Indexed rather than a Set because a large paste
    // lands here whole, making the per-candidate lookups below quadratic.
    const freshLive = new WireRowColumnIndex();
    // In the tree and due for removal: removedWires plus what splits and
    // merges consume.
    const liveOriginalsToRemove = new Set<Wire>();
    // Created inside the integrator; destroyed if consumed before becoming
    // output, so they don't leak.
    const internalWires = new Set<Wire>();

    for (const w of addedWires) {
      if (w.length === 0) continue;
      const [s, e] = w.connectionPoints;
      addCandidate(s);
      addCandidate(e);
      freshLive.add(w);
    }
    for (const w of removedWires) {
      const [s, e] = w.connectionPoints;
      addCandidate(s);
      addCandidate(e);
      liveOriginalsToRemove.add(w);
    }
    for (const { wire, oldSnapshot } of movedWires) {
      if (wire.length !== 0) {
        const [s, e] = wire.connectionPoints;
        addCandidate(s);
        addCandidate(e);
      }
      addCandidate(oldSnapshot.start);
      addCandidate(oldSnapshot.end);
    }
    for (const p of addedComponentPorts) addCandidate(p);
    for (const p of removedComponentPorts) addCandidate(p);
    for (const { oldPorts, newPorts } of movedComponentPorts) {
      for (const p of oldPorts) addCandidate(p);
      for (const p of newPorts) addCandidate(p);
    }
    for (const p of vacatedPoints) addCandidate(p);

    // Port-presence delta against what queries return: added ports are not in
    // the tree yet (+1), removed ones are still in it (-1). Moved components
    // need no delta — they are already at their new positions.
    const portDelta = new Map<string, number>();
    const bumpPort = (p: Point, delta: number) => {
      const k = pointKey(p);
      portDelta.set(k, (portDelta.get(k) ?? 0) + delta);
    };
    for (const p of addedComponentPorts) bumpPort(p, 1);
    for (const p of removedComponentPorts) bumpPort(p, -1);

    // Does the post-state contain a port at P?
    const hasPort = (p: Point): boolean => {
      const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
      let count = 0;
      for (const comp of queryComponentsInRange(queryRect)) {
        for (const port of comp.connectionPoints) {
          if (port.x === p.x && port.y === p.y) count++;
        }
      }
      count += portDelta.get(pointKey(p)) ?? 0;
      return count > 0;
    };

    // Working set = project tree − liveOriginalsToRemove + freshLive, filtered
    // to a 2×2 rect around P.
    const collectWorkingWiresAt = (p: Point): Wire[] => {
      const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
      const result: Wire[] = [];
      for (const w of queryWiresInRange(queryRect)) {
        if (liveOriginalsToRemove.has(w)) continue;
        if (freshLive.all.has(w)) continue; // avoid duplicating an instance that lives in both
        result.push(w);
      }
      for (const w of freshLive.query(queryRect)) result.push(w);
      return result;
    };

    const consumeFresh = (w: Wire): boolean => {
      if (freshLive.all.has(w)) {
        freshLive.remove(w);
        if (internalWires.has(w)) {
          internalWires.delete(w);
          if (!w.destroyed) w.destroy();
        }
        return true;
      }
      return false;
    };
    const consumeWire = (w: Wire) => {
      if (!consumeFresh(w)) {
        liveOriginalsToRemove.add(w);
      }
    };

    // Junctions consolidation buries inside a merged span. Absorbing a
    // collinear wire turns a user-made perpendicular junction into interior,
    // so the perpendicular pair loses its third terminator and the merge pass
    // would fuse it, silently disconnecting the junction. Remembering the
    // point keeps the merge pass off it and the split pass re-cuts there.
    // Ports need no protection: hasPort() reports them independently.
    const preservedJunctions = new Set<string>();
    const notePreservedJunctions = (merged: Wire, a: Wire, b: Wire) => {
      for (const absorbed of [a, b]) {
        for (const p of absorbed.connectionPoints) {
          const k = pointKey(p);
          if (preservedJunctions.has(k)) continue;
          if (!this._interiorContains(merged, p)) continue;
          for (const other of collectWorkingWiresAt(p)) {
            if (other === a || other === b) continue;
            // A collinear neighbour is absorbed too, so only a perpendicular
            // endpoint marks a junction.
            if (other.direction === merged.direction) continue;
            if (this._endpointEquals(other, p)) {
              preservedJunctions.add(k);
              break;
            }
          }
        }
      }
    };

    // Absorbs collinear-overlapping wires into one, once per added/moved wire.
    // Without it the split pass would cut every participant of an overlap and
    // produce duplicate pieces.
    const consolidateWire = (initialWire: Wire) => {
      let mergedW = initialWire;
      let changed = true;
      while (changed) {
        changed = false;
        const bounds = mergedW.gridBounds;
        const collinear: Wire[] = [];
        for (const c of queryWiresInRange(bounds)) {
          if (c === mergedW) continue;
          if (liveOriginalsToRemove.has(c)) continue;
          if (freshLive.all.has(c)) continue;
          collinear.push(c);
        }
        for (const c of freshLive.query(bounds)) {
          if (c !== mergedW) collinear.push(c);
        }

        for (const c of collinear) {
          if (c.direction !== mergedW.direction) continue;
          if (!this._isSameAxis(mergedW, c)) continue;
          const aStart = axisPos(mergedW);
          const aEnd = aStart + mergedW.length;
          const cStart = axisPos(c);
          const cEnd = cStart + c.length;
          const overlapStart = Math.max(aStart, cStart);
          const overlapEnd = Math.min(aEnd, cEnd);
          if (overlapStart >= overlapEnd) continue;

          const newMerged = Wire.merge(mergedW, c);
          newMerged.applyScale(scale);
          notePreservedJunctions(newMerged, mergedW, c);
          internalWires.add(newMerged);
          consumeWire(mergedW);
          consumeWire(c);
          mergedW = newMerged;
          freshLive.add(mergedW);
          const [ms, me] = mergedW.connectionPoints;
          addCandidate(ms);
          addCandidate(me);
          changed = true;
          break;
        }
      }
    };

    for (const w of addedWires) {
      if (w.length === 0) continue;
      if (!freshLive.all.has(w)) continue;
      consolidateWire(w);
    }
    for (const { wire } of movedWires) {
      if (wire.length === 0) continue;
      if (liveOriginalsToRemove.has(wire)) continue;
      consolidateWire(wire);
    }

    // Stationary endpoints/ports strictly inside an added or moved wire's body
    // are what force a split-on-add.
    const scanForInteriorCandidates = (w: Wire) => {
      if (w.length === 0 || w.destroyed) return;
      const bounds = w.gridBounds;
      for (const existing of queryWiresInRange(bounds)) {
        if (existing === w) continue;
        if (liveOriginalsToRemove.has(existing)) continue;
        const [s, e] = existing.connectionPoints;
        if (this._interiorContains(w, s)) addCandidate(s);
        if (this._interiorContains(w, e)) addCandidate(e);
      }
      for (const comp of queryComponentsInRange(bounds)) {
        for (const port of comp.connectionPoints) {
          if (this._interiorContains(w, port)) addCandidate(port);
        }
      }
    };
    // freshLive, not addedWires: consolidate may have replaced them.
    for (const w of freshLive.all) scanForInteriorCandidates(w);
    // Moved wires that survived consolidation live in the tree, not freshLive.
    for (const { wire } of movedWires) {
      if (liveOriginalsToRemove.has(wire)) continue;
      scanForInteriorCandidates(wire);
    }

    // A split is only justified where something else actually terminates: a
    // candidate that drifted in from a removal or move must not cause one.
    const isTermination = (p: Point, excludeWire: Wire): boolean => {
      if (hasPort(p)) return true;
      for (const w of collectWorkingWiresAt(p)) {
        if (w === excludeWire) continue;
        if (this._endpointEquals(w, p)) return true;
      }
      return false;
    };

    // Each pass snapshots the candidate set so cascading updates land in the
    // next iteration, keeping the result independent of Map iteration order.
    let iteration = 0;
    let changed = true;
    while (changed) {
      if (iteration >= MAX_ITERATIONS) {
        getStaticDI(LoggingService).error(
          `Fixed-point loop did not converge in ${MAX_ITERATIONS} iterations; ` +
            `input: addedWires=${addedWires.length} removedWires=${removedWires.length} ` +
            `movedWires=${movedWires.length} addedComponentPorts=${addedComponentPorts.length} ` +
            `removedComponentPorts=${removedComponentPorts.length} movedComponentPorts=${movedComponentPorts.length} ` +
            `vacatedPoints=${vacatedPoints.length}; ` +
            `candidates=${candidates.size} freshLive=${freshLive.all.size} liveOriginalsToRemove=${liveOriginalsToRemove.size}`,
          'WireIntegrator'
        );
        throw new Error(
          `WireIntegrator: fixed-point loop did not converge in ${MAX_ITERATIONS} iterations`
        );
      }
      iteration++;
      changed = false;

      // Merge pass: at each candidate P, fuse a collinear pair ending there iff
      // nothing else terminates at P. It runs before the split pass because
      // where the pair's shared endpoint sits on a third wire's interior, merge
      // and split are each self-justifying; merging first resolves that toward
      // a plain crossing, so moving both halves of a split wire across another
      // behaves like moving one unsplit wire.
      const mergeSnapshot = [...candidates.values()];
      for (const p of mergeSnapshot) {
        // A buried junction keeps its terminations; the split pass re-cuts it.
        if (preservedJunctions.has(pointKey(p))) continue;
        for (const direction of [
          WireDirection.HORIZONTAL,
          WireDirection.VERTICAL
        ]) {
          const ending = collectWorkingWiresAt(p).filter(
            (w) => w.direction === direction && this._endpointEquals(w, p)
          );
          if (ending.length !== 2) continue;
          if (
            this._hasThirdTerminatorAt(
              p,
              ending,
              collectWorkingWiresAt,
              hasPort
            )
          )
            continue;

          const [wa, wb] = ending;
          const merged = Wire.merge(wa, wb);
          merged.applyScale(scale);
          internalWires.add(merged);
          consumeWire(wa);
          consumeWire(wb);
          freshLive.add(merged);
          addCandidate(merged.connectionPoints[0]);
          addCandidate(merged.connectionPoints[1]);
          changed = true;
        }
      }

      // Split pass: cut any wire whose interior contains a candidate P, but
      // only where some other endpoint or port sits at P — i.e. where I1/I2 is
      // actually violated.
      const splitSnapshot = [...candidates.values()];
      for (const p of splitSnapshot) {
        for (const w of collectWorkingWiresAt(p)) {
          if (!this._interiorContains(w, p)) continue;
          if (!isTermination(p, w)) continue;
          const [w1, w2] = this._splitWire(w, p, scale);
          internalWires.add(w1);
          internalWires.add(w2);
          consumeWire(w);
          freshLive.add(w1);
          freshLive.add(w2);
          const [s1, e1] = w1.connectionPoints;
          const [s2, e2] = w2.connectionPoints;
          addCandidate(s1);
          addCandidate(e1);
          addCandidate(s2);
          addCandidate(e2);
          changed = true;
        }
      }
    }

    const output = {
      toAdd: [...freshLive.all],
      toRemove: [...liveOriginalsToRemove]
    };
    getStaticDI(LoggingService).debug(
      `integrate converged in ${iteration} pass(es); wires added=${output.toAdd.length} removed=${output.toRemove.length}`,
      'WireIntegrator'
    );
    return output;
  }

  private _interiorContains(w: Wire, p: Point): boolean {
    if (!w.contains(p)) return false;
    return !this._endpointEquals(w, p);
  }

  private _endpointEquals(w: Wire, p: Point): boolean {
    const [s, e] = w.connectionPoints;
    return (s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y);
  }

  private _splitWire(w: Wire, p: Point, scale: number): [Wire, Wire] {
    const [w1, w2] = Wire.split(w, p);
    w1.applyScale(scale);
    w2.applyScale(scale);
    return [w1, w2];
  }

  private _hasThirdTerminatorAt(
    p: Point,
    exclude: readonly Wire[],
    collectWorkingWiresAt: (p: Point) => Wire[],
    hasPort: (p: Point) => boolean
  ): boolean {
    if (hasPort(p)) return true;
    const excludeSet = new Set(exclude);
    for (const w of collectWorkingWiresAt(p)) {
      if (excludeSet.has(w)) continue;
      if (this._endpointEquals(w, p)) return true;
    }
    return false;
  }

  private _isSameAxis(a: Wire, b: Wire): boolean {
    if (a.direction === WireDirection.HORIZONTAL) {
      return a.position.y === b.position.y;
    }
    return a.position.x === b.position.x;
  }
}
