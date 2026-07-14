import { Container, Point } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireSnapshot } from '../wires/wire-snapshot.model';
import { Component } from '../components/component';
import { ConnectionPoint } from './connection-point';
import { ConnectionPointLayer } from './connection-point-layer';
import { pointKey, PointSet } from '../utils/point-key';

export class ConnectionPointManager {
  public readonly layer = new ConnectionPointLayer();

  private readonly _cps = new Map<string, ConnectionPoint>();

  // How many wire endpoints / component ports terminate at each "x,y". A dot
  // exists iff this reaches 3 (see _evaluateAt), so maintaining it incrementally
  // turns CP evaluation into a map lookup instead of a quad-tree range query.
  // Kept in lock-step with the project's wire/component membership: every
  // add/remove/move/detach path adjusts it at the affected points.
  private readonly _terminationCounts = new Map<string, number>();

  constructor(private readonly getScale: () => number) {}

  public onWireAdded(snapshot: WireSnapshot): void {
    this._changeWireTerminations(snapshot, +1);
    this._recomputeForWireChange(snapshot);
  }

  public onWireRemoved(snapshot: WireSnapshot): void {
    this._changeWireTerminations(snapshot, -1);
    this._recomputeForWireChange(snapshot);
  }

  public onComponentAdded(ports: readonly Point[]): void {
    for (const p of ports) this._changeTermination(p, +1);
    this._recomputeForComponentChange(ports);
  }

  public onComponentRemoved(ports: readonly Point[]): void {
    for (const p of ports) this._changeTermination(p, -1);
    this._recomputeForComponentChange(ports);
  }

  /**
   * Adjusts termination counts for a set of elements without recomputing any
   * dots. Used by the drag lifecycle: detach removes the counts at the pre-drag
   * positions, reattach re-adds them at the post-drag positions, keeping the
   * count map mirroring quad-tree membership so the settle pass (and any wire
   * splits/merges) sees correct counts. The visible dots are reconciled once at
   * the end via recomputeCpsForMovedSelection.
   */
  public addTerminations(
    components: Iterable<Component>,
    wires: Iterable<Wire>
  ): void {
    this._changeTerminationsOf(components, wires, +1);
  }

  public removeTerminations(
    components: Iterable<Component>,
    wires: Iterable<Wire>
  ): void {
    this._changeTerminationsOf(components, wires, -1);
  }

  public recomputeAll(
    allWires: Iterable<Wire>,
    allComponents: Iterable<Component>
  ): void {
    // cp.destroy() detaches from the parent layer as well as freeing GPU resources.
    for (const cp of this._cps.values()) {
      cp.destroy();
    }
    this._cps.clear();

    // items yields one-shot iterators, so materialize before the two passes.
    const components = [...allComponents];
    const wires = [...allWires];

    // Rebuild the termination counts from scratch in one linear pass, then
    // derive each unique candidate point from the map.
    this._terminationCounts.clear();
    this._changeTerminationsOf(components, wires, +1);

    const candidates = new PointSet();
    for (const wire of wires) {
      const [start, end] = wire.connectionPoints;
      candidates.add(start);
      candidates.add(end);
    }
    for (const comp of components) {
      for (const p of comp.connectionPoints) {
        candidates.add(p);
      }
    }

    for (const p of candidates) {
      this.recomputeAt(p);
    }
  }

  /**
   * Re-colours every existing CP for a theme change without touching topology.
   * CP existence/position depend only on the circuit, not the theme, so a theme
   * switch never adds or removes dots — it only re-derives their tint (the
   * context is a shared theme-independent white base). Much cheaper than
   * {@link recomputeAll}, which re-queries the quad tree.
   */
  public refreshTheme(): void {
    for (const cp of this._cps.values()) {
      cp.refreshTint();
    }
  }

  public recomputeAt(p: Point): void {
    const shouldExist = this._evaluateAt(p);
    const key = pointKey(p);
    const existing = this._cps.get(key);

    if (shouldExist && !existing) {
      const cp = new ConnectionPoint(p);
      cp.applyScale(this.getScale());
      this.layer.addChild(cp);
      this._cps.set(key, cp);
    } else if (!shouldExist && existing) {
      existing.destroy();
      this._cps.delete(key);
    }
  }

  public affectedPointsForWire(wire: Wire): Iterable<Point> {
    const [start, end] = wire.connectionPoints;
    return [start, end];
  }

  public affectedPointsForSnapshot(snap: WireSnapshot): Iterable<Point> {
    return [snap.start, snap.end];
  }

  public getCpAt(p: Point): ConnectionPoint | undefined {
    return this._cps.get(pointKey(p));
  }

  public getCpsAtPoints(points: Iterable<Point>): ConnectionPoint[] {
    const result: ConnectionPoint[] = [];
    for (const p of points) {
      const cp = this._cps.get(pointKey(p));
      if (cp) result.push(cp);
    }
    return result;
  }

  public detachCp(cp: ConnectionPoint): void {
    const key = pointKey(cp.position);
    this._cps.delete(key);
    this.layer.removeChild(cp);
  }

  public reattachCp(cp: ConnectionPoint): void {
    const key = pointKey(cp.position);
    this._cps.set(key, cp);
    this.layer.addChild(cp);
  }

  public hasCpAt(p: Point): boolean {
    return this._cps.has(pointKey(p));
  }

  public captureDragCps(
    components: readonly Component[],
    wires: readonly Wire[],
    dragLayer: Container,
    only?: ReadonlySet<ConnectionPoint>
  ): ConnectionPoint[] {
    const points = this._terminationPointsOf(components, wires);
    const captured: ConnectionPoint[] = [];
    for (const p of points) {
      const cp = this.getCpAt(p);
      // With `only` given, carry just those dots — the drag follows what looks
      // selected, not every junction the dragged elements happen to touch.
      if (cp && (!only || only.has(cp))) {
        this.detachCp(cp);
        dragLayer.addChild(cp);
        captured.push(cp);
      }
    }
    return captured;
  }

  public discardDragCps(captured: readonly ConnectionPoint[]): void {
    for (const cp of captured) {
      cp.destroy();
    }
  }

  public restoreDragCps(captured: readonly ConnectionPoint[]): void {
    for (const cp of captured) {
      this.reattachCp(cp);
    }
  }

  public recomputeCpsForMovedSelection(
    oldComponentPorts: ReadonlyMap<number, readonly Point[]>,
    oldWireSnapshots: readonly WireSnapshot[],
    newComponents: readonly Component[],
    newWires: readonly Wire[]
  ): void {
    const points = this._terminationPointsOf(newComponents, newWires);

    for (const ports of oldComponentPorts.values()) {
      for (const p of ports) points.add(p);
    }
    for (const snap of oldWireSnapshots) {
      for (const p of this.affectedPointsForSnapshot(snap)) {
        points.add(p);
      }
    }
    for (const w of newWires) {
      for (const p of this.affectedPointsForWire(w)) {
        points.add(p);
      }
    }

    for (const p of points) {
      this.recomputeAt(p);
    }
  }

  private _recomputeForWireChange(snapshot: WireSnapshot): void {
    for (const p of this.affectedPointsForSnapshot(snapshot)) {
      this.recomputeAt(p);
    }
  }

  private _recomputeForComponentChange(ports: readonly Point[]): void {
    for (const p of ports) {
      this.recomputeAt(p);
    }
  }

  private _terminationPointsOf(
    components: readonly Component[],
    wires: readonly Wire[]
  ): PointSet {
    const points = new PointSet();
    for (const c of components) {
      for (const p of c.connectionPoints) points.add(p);
    }
    for (const w of wires) {
      const [start, end] = w.connectionPoints;
      points.add(start);
      points.add(end);
    }
    return points;
  }

  private _evaluateAt(p: Point): boolean {
    // Under the split-on-touch invariants, wire interiors never contain a wire
    // endpoint or component port, so termination counting collapses to exact
    // endpoint-equality — which the maintained count map already holds. A CP
    // exists iff at least 3 things terminate at P.
    return (this._terminationCounts.get(pointKey(p)) ?? 0) >= 3;
  }

  private _changeWireTerminations(snap: WireSnapshot, delta: number): void {
    this._changeTermination(snap.start, delta);
    this._changeTermination(snap.end, delta);
  }

  private _changeTerminationsOf(
    components: Iterable<Component>,
    wires: Iterable<Wire>,
    delta: number
  ): void {
    // Multiplicity matters: two endpoints landing on one point count as two, so
    // this never de-duplicates the way the candidate PointSet does.
    for (const c of components) {
      if (c.destroyed) continue;
      for (const p of c.connectionPoints) this._changeTermination(p, delta);
    }
    for (const w of wires) {
      if (w.destroyed) continue;
      const [start, end] = w.connectionPoints;
      this._changeTermination(start, delta);
      this._changeTermination(end, delta);
    }
  }

  private _changeTermination(p: Point, delta: number): void {
    const key = pointKey(p);
    const next = (this._terminationCounts.get(key) ?? 0) + delta;
    if (next <= 0) {
      this._terminationCounts.delete(key);
    } else {
      this._terminationCounts.set(key, next);
    }
  }
}
