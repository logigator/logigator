import { Container, Point } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireSnapshot } from '../wires/wire-snapshot.model';
import { Component } from '../components/component';
import { ConnectionPoint } from './connection-point';
import { ConnectionPointLayer } from './connection-point-layer';
import { PointMap, PointSet } from '../utils/point-key';

export class ConnectionPointManager {
  public readonly layer = new ConnectionPointLayer();

  private readonly _cps = new PointMap<ConnectionPoint>();

  // Wire endpoints and component ports terminating at each "x,y". A dot exists
  // iff this reaches 3, so maintaining it incrementally makes CP evaluation a
  // map lookup instead of a range query. Every add/remove/move/detach path
  // keeps it in lock-step with the project's membership.
  private readonly _terminationCounts = new PointMap<number>();

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
   * Adjusts termination counts without recomputing any dots, so a drag can drop
   * them at the pre-drag positions and re-add them at the post-drag ones. The
   * count map keeps mirroring quad-tree membership throughout; the visible dots
   * are reconciled once at the end.
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
    // destroy() detaches from the layer as well as freeing GPU resources.
    for (const cp of this._cps) {
      cp.destroy();
    }
    this._cps.clear();

    // One-shot iterators, so materialize before the two passes.
    const components = [...allComponents];
    const wires = [...allWires];

    this._terminationCounts.clear();
    this._changeTerminationsOf(components, wires, +1);

    const candidates = new PointSet<Point>();
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
   * Re-colours every CP without touching topology: existence and position
   * depend on the circuit alone, so a theme switch only re-derives tints (the
   * shared context is a theme-independent white base).
   */
  public refreshTheme(): void {
    for (const cp of this._cps) {
      cp.refreshTint();
    }
  }

  public recomputeAt(p: Point): void {
    const shouldExist = this._evaluateAt(p);
    const existing = this._cps.get(p);

    if (shouldExist && !existing) {
      const cp = new ConnectionPoint(p);
      cp.applyScale(this.getScale());
      this.layer.addChild(cp);
      this._cps.set(p, cp);
    } else if (!shouldExist && existing) {
      existing.destroy();
      this._cps.delete(p);
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
    return this._cps.get(p);
  }

  public getCpsAtPoints(points: Iterable<Point>): ConnectionPoint[] {
    const result: ConnectionPoint[] = [];
    for (const p of points) {
      const cp = this._cps.get(p);
      if (cp) result.push(cp);
    }
    return result;
  }

  public detachCp(cp: ConnectionPoint): void {
    this._cps.delete(cp.position);
    this.layer.removeChild(cp);
  }

  public reattachCp(cp: ConnectionPoint): void {
    this._cps.set(cp.position, cp);
    this.layer.addChild(cp);
  }

  public hasCpAt(p: Point): boolean {
    return this._cps.has(p);
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
      // With `only` given the drag carries just those dots, following what
      // looks selected rather than every junction it touches.
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
  ): PointSet<Point> {
    const points = new PointSet<Point>();
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
    // A CP exists iff at least 3 things terminate at P. Under the
    // split-on-touch invariants a wire interior never contains an endpoint or
    // port, so counting collapses to the exact-equality map.
    return (this._terminationCounts.get(p) ?? 0) >= 3;
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
    // Multiplicity matters: two endpoints on one point count as two, so this
    // never de-duplicates the way the candidate PointSet does.
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
    const next = (this._terminationCounts.get(p) ?? 0) + delta;
    if (next <= 0) {
      this._terminationCounts.delete(p);
    } else {
      this._terminationCounts.set(p, next);
    }
  }
}
