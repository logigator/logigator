import { Container, Point, Rectangle } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireSnapshot } from '../wires/wire-snapshot.model';
import { Component } from '../components/component';
import { ConnectionPoint } from './connection-point';
import { ConnectionPointLayer } from './connection-point-layer';

/** De-duplicating set of Points keyed by "x,y". */
class PointSet implements Iterable<Point> {
	private readonly _map = new Map<string, Point>();

	public add(p: Point): void {
		const key = `${p.x},${p.y}`;
		if (!this._map.has(key)) {
			this._map.set(key, p);
		}
	}

	public [Symbol.iterator](): Iterator<Point> {
		return this._map.values();
	}
}

export class ConnectionPointManager {
	public readonly layer = new ConnectionPointLayer();

	private readonly _cps = new Map<string, ConnectionPoint>();

	constructor(
		private readonly queryWiresInRange: (rect: Rectangle) => Generator<Wire>,
		private readonly queryComponentsInRange: (
			rect: Rectangle
		) => Generator<Component>,
		private readonly getScale: () => number
	) {}

	public onWireAdded(snapshot: WireSnapshot): void {
		this._recomputeForWireChange(snapshot);
	}

	public onWireRemoved(snapshot: WireSnapshot): void {
		this._recomputeForWireChange(snapshot);
	}

	public onComponentAdded(ports: readonly Point[]): void {
		this._recomputeForComponentChange(ports);
	}

	public onComponentRemoved(ports: readonly Point[]): void {
		this._recomputeForComponentChange(ports);
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

		const candidates = new PointSet();
		for (const wire of allWires) {
			const [start, end] = wire.connectionPoints;
			candidates.add(start);
			candidates.add(end);
		}
		for (const comp of allComponents) {
			for (const p of comp.connectionPoints) {
				candidates.add(p);
			}
		}

		for (const p of candidates) {
			this.recomputeAt(p);
		}
	}

	public recomputeAt(p: Point): void {
		const shouldExist = this._evaluateAt(p);
		const key = this._key(p);
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
		return this._cps.get(this._key(p));
	}

	public getCpsAtPoints(points: Iterable<Point>): ConnectionPoint[] {
		const result: ConnectionPoint[] = [];
		for (const p of points) {
			const cp = this._cps.get(this._key(p));
			if (cp) result.push(cp);
		}
		return result;
	}

	public detachCp(cp: ConnectionPoint): void {
		const key = this._key(cp.position);
		this._cps.delete(key);
		this.layer.removeChild(cp);
	}

	public reattachCp(cp: ConnectionPoint): void {
		const key = this._key(cp.position);
		this._cps.set(key, cp);
		this.layer.addChild(cp);
	}

	public hasCpAt(p: Point): boolean {
		return this._cps.has(this._key(p));
	}

	public captureDragCps(
		components: readonly Component[],
		wires: readonly Wire[],
		dragLayer: Container
	): ConnectionPoint[] {
		const points = this._terminationPointsOf(components, wires);
		const captured: ConnectionPoint[] = [];
		for (const p of points) {
			const cp = this.getCpAt(p);
			if (cp) {
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

	private _key(p: Point): string {
		return `${p.x},${p.y}`;
	}

	private _evaluateAt(p: Point): boolean {
		// Under the split-on-touch invariants, wire interiors never contain a wire
		// endpoint or component port, so termination counting collapses to exact
		// endpoint-equality. A CP exists iff at least 3 things terminate at P.
		const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
		let terminations = 0;
		for (const wire of this.queryWiresInRange(queryRect)) {
			const [start, end] = wire.connectionPoints;
			if (start.x === p.x && start.y === p.y) terminations++;
			if (end.x === p.x && end.y === p.y) terminations++;
			if (terminations >= 3) return true;
		}
		for (const comp of this.queryComponentsInRange(queryRect)) {
			for (const port of comp.connectionPoints) {
				if (port.x === p.x && port.y === p.y) {
					terminations++;
					if (terminations >= 3) return true;
				}
			}
		}
		return false;
	}
}
