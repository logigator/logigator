import { Container, Matrix, Point, Rectangle } from 'pixi.js';

import { Grid } from '../rendering/grid';
import { ComponentConfig } from '../components/component-config.model';
import { InteractionContainer } from '../rendering/interaction-container';
import { Component } from '../components/component';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { WorkMode } from '../work-mode/work-mode.enum';
import { FloatingLayer } from '../rendering/floating-layer';
import { ActionManager } from '../actions/action-manager';
import { SelectionManager } from './selection-manager';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { QuadTreeContainer } from '../rendering/quad-tree-container';

export class Project extends InteractionContainer {
	public readonly actionManager = new ActionManager(this);
	public readonly selectionManager = new SelectionManager(this);

	private readonly _scaleStepAmount = 1.2;
	private readonly _scaleStepMin = -12;
	private readonly _scaleStepMax = 5;
	private _scaleStep = 0;

	private readonly _grid: Grid = new Grid();
	private readonly _gridSpace = new Container();
	private readonly _wires = new QuadTreeContainer<Wire>();
	private readonly _components = new QuadTreeContainer<Component>();
	private readonly _floatingLayer = new FloatingLayer(this);

	private _viewPortSize = new Point(0, 0);

	private readonly _positionChange$ = new Subject<Point>();

	constructor() {
		super();

		this.boundsArea = new Rectangle(
			-Number.MAX_VALUE / 2,
			-Number.MAX_VALUE / 2,
			Number.MAX_VALUE,
			Number.MAX_VALUE
		);
		this.hitArea = this.boundsArea;

		this._gridSpace.scale.set(environment.gridSize);

		this.addChild(this._grid);
		this.addChild(this._gridSpace);

		this._gridSpace.addChild(this._wires);
		this._gridSpace.addChild(this._components);
		this._gridSpace.addChild(this._floatingLayer);
	}

	public get gridSpace(): Container {
		return this._gridSpace;
	}

	public resizeViewport(width: number, height: number) {
		this._viewPortSize.set(width, height);
		this._grid.resizeViewport(this._viewPortSize);
	}

	public pan(point: Point): void {
		this.setPosition(point.add(this.position));
	}

	public setPosition(point: Point): void {
		this.position.copyFrom(point);
		this._grid.updatePosition(this.position);
		this._positionChange$.next(this.gridPosition);
	}

	public zoomIn(center?: Point) {
		if (this._scaleStep >= this._scaleStepMax) return;
		this.updateScale(
			Math.pow(this._scaleStepAmount, ++this._scaleStep),
			center
		);
	}

	public zoomOut(center?: Point) {
		if (this._scaleStep <= this._scaleStepMin) return;
		this.updateScale(
			Math.pow(this._scaleStepAmount, --this._scaleStep),
			center
		);
	}

	public zoom100(center?: Point) {
		this._scaleStep = 0;
		this.updateScale(1, center);
	}

	public get positionChange$(): Observable<Point> {
		return this._positionChange$.asObservable();
	}

	public get gridPosition() {
		return this.position.multiplyScalar(
			1 / (this.scale.x * environment.gridSize)
		);
	}

	public get mode(): WorkMode {
		return this._floatingLayer.mode;
	}

	public set mode(mode: WorkMode) {
		this._floatingLayer.mode = mode;
	}

	public get componentToPlace(): ComponentConfig | null {
		return this._floatingLayer.componentToPlace;
	}

	public set componentToPlace(component: ComponentConfig | null) {
		this._floatingLayer.componentToPlace = component;
	}

	public addComponent(component: Component) {
		component.applyScale(this.scale.x);
		this._components.insert(component);
		this._ticker$.next('single');
	}

	public removeComponent(componentId: number) {
		const component = Array.from(this._components.items).find(
			(c) => c.id === componentId
		);
		if (!component) return;
		this.selectionManager.evict(component);
		this._components.remove(component);
		component.destroy({ children: true });
		this._ticker$.next('single');
	}

	public addWire(wire: Wire) {
		wire.applyScale(this.scale.x);
		this._wires.insert(wire);
		this._ticker$.next('single');
	}

	public removeWire(wireId: number) {
		const wire = Array.from(this._wires.items).find((w) => w.id === wireId);
		if (!wire) return;
		this.selectionManager.evict(wire);
		this._wires.remove(wire);
		wire.destroy();
		this._ticker$.next('single');
	}

	public hasComponentCollision(
		bounds: Rectangle,
		excludeIds: ReadonlySet<number> = new Set()
	): boolean {
		for (const comp of this.queryComponentsInRange(bounds)) {
			if (!excludeIds.has(comp.id)) return true;
		}
		return false;
	}

	public *queryComponentsInRange(rect: Rectangle): Generator<Component> {
		yield* this._components.queryRange(rect);
	}

	public *queryWiresInRange(rect: Rectangle): Generator<Wire> {
		yield* this._wires.queryRange(rect);
	}

	public hasWireBodyCollision(
		wireBounds: Rectangle,
		excludeIds: ReadonlySet<number> = new Set()
	): boolean {
		for (const comp of this.queryComponentsInRange(wireBounds)) {
			if (excludeIds.has(comp.id)) continue;
			if (wireBounds.intersects(comp.bodyGridBounds)) return true;
		}
		return false;
	}

	public hasComponentBodyWireCollision(
		bodyBounds: Rectangle,
		excludeIds: ReadonlySet<number> = new Set()
	): boolean {
		for (const wire of this.queryWiresInRange(bodyBounds)) {
			if (excludeIds.has(wire.id)) continue;
			if (wire.gridBounds.intersects(bodyBounds)) return true;
		}
		return false;
	}

	public computeWireIntegration(
		newWires: Wire[]
	): { toAdd: Wire[]; toRemove: Wire[] } {
		const toAdd: Wire[] = [];
		const toRemove = new Set<Wire>();

		for (const n of newWires) {
			const mergeGroup: Wire[] = [n];
			let segStart = this._axisPos(n);
			let segEnd = segStart + n.length;
			let changed = true;

			while (changed) {
				changed = false;
				const queryRect = this._collinearQueryRect(n.direction, n.position, segStart, segEnd);

				for (const c of this.queryWiresInRange(queryRect)) {
					if (c === n || toRemove.has(c)) continue;
					if (c.direction !== n.direction) continue;
					if (!this._isSameAxis(n, c)) continue;

					const cStart = this._axisPos(c);
					const cEnd = cStart + c.length;

					const overlapStart = Math.max(segStart, cStart);
					const overlapEnd = Math.min(segEnd, cEnd);

					if (overlapStart < overlapEnd) {
						// Segments share interior — always merge
						toRemove.add(c);
						mergeGroup.push(c);
						segStart = Math.min(segStart, cStart);
						segEnd = Math.max(segEnd, cEnd);
						changed = true;
					} else if (overlapStart === overlapEnd) {
						// Adjacent at a single point P
						const p =
							n.direction === WireDirection.HORIZONTAL
								? new Point(overlapStart, n.position.y)
								: new Point(n.position.x, overlapStart);
						// Exclude the merging wires and all already-consumed wires so they
						// don't produce false T-junction detections.
						if (!this._hasTJunctionAt(p, new Set([...toRemove, ...mergeGroup, c]))) {
							toRemove.add(c);
							mergeGroup.push(c);
							segStart = Math.min(segStart, cStart);
							segEnd = Math.max(segEnd, cEnd);
							changed = true;
						}
					}
				}
			}

			if (mergeGroup.length > 1) {
				toAdd.push(this._createMergedWire(n.direction, n.position, segStart, segEnd));
				toRemove.add(n);
			} else {
				toAdd.push(n);
			}
		}

		// Second pass: merge toAdd wires with each other.
		// Needed when two new wires are adjacent to opposite ends of the same existing
		// wire — the first new wire consumes the existing wire, but the second can't see
		// the merged result via the quad tree.
		let secondPassChanged = true;
		while (secondPassChanged) {
			secondPassChanged = false;
			outer: for (let i = 0; i < toAdd.length; i++) {
				for (let j = i + 1; j < toAdd.length; j++) {
					const wi = toAdd[i];
					const wj = toAdd[j];
					if (wi.direction !== wj.direction || !this._isSameAxis(wi, wj)) continue;

					const iStart = this._axisPos(wi);
					const iEnd = iStart + wi.length;
					const jStart = this._axisPos(wj);
					const jEnd = jStart + wj.length;

					const overlapStart = Math.max(iStart, jStart);
					const overlapEnd = Math.min(iEnd, jEnd);

					if (overlapStart > overlapEnd) continue;

					if (overlapStart === overlapEnd) {
						const p =
							wi.direction === WireDirection.HORIZONTAL
								? new Point(overlapStart, wi.position.y)
								: new Point(wi.position.x, overlapStart);
						if (this._hasTJunctionAt(p, new Set([...toRemove, wi, wj]))) continue;
					}

					const mergedStart = Math.min(iStart, jStart);
					const mergedEnd = Math.max(iEnd, jEnd);
					const merged = this._createMergedWire(wi.direction, wi.position, mergedStart, mergedEnd);

					// Original new wires consumed here must be tracked for removal.
					if (newWires.includes(wi)) toRemove.add(wi);
					if (newWires.includes(wj)) toRemove.add(wj);

					toAdd.splice(j, 1);
					toAdd.splice(i, 1);
					toAdd.push(merged);
					secondPassChanged = true;
					break outer;
				}
			}
		}

		return { toAdd, toRemove: [...toRemove] };
	}

	private _axisPos(w: Wire): number {
		return w.direction === WireDirection.HORIZONTAL ? w.position.x : w.position.y;
	}

	private _createMergedWire(
		direction: WireDirection,
		refPos: Point,
		segStart: number,
		segEnd: number
	): Wire {
		const merged = new Wire(direction, segEnd - segStart);
		if (direction === WireDirection.HORIZONTAL) {
			merged.position.set(segStart, refPos.y);
		} else {
			merged.position.set(refPos.x, segStart);
		}
		merged.applyScale(this.scale.x);
		return merged;
	}

	private _collinearQueryRect(
		direction: WireDirection,
		pos: Point,
		segStart: number,
		segEnd: number
	): Rectangle {
		if (direction === WireDirection.HORIZONTAL) {
			return new Rectangle(segStart - 1, Math.floor(pos.y), segEnd - segStart + 2, 1);
		}
		return new Rectangle(Math.floor(pos.x), segStart - 1, 1, segEnd - segStart + 2);
	}

	private _isSameAxis(a: Wire, b: Wire): boolean {
		if (a.direction === WireDirection.HORIZONTAL) {
			return a.position.y === b.position.y;
		}
		return a.position.x === b.position.x;
	}

	private _hasTJunctionAt(p: Point, exclude: Set<Wire>): boolean {
		const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
		for (const w of this.queryWiresInRange(queryRect)) {
			if (exclude.has(w)) continue;
			if (this._pointOnWire(p, w)) return true;
		}
		return false;
	}

	private _pointOnWire(p: Point, w: Wire): boolean {
		if (w.direction === WireDirection.HORIZONTAL) {
			return p.y === w.position.y && p.x >= w.position.x && p.x <= w.position.x + w.length;
		}
		return p.x === w.position.x && p.y >= w.position.y && p.y <= w.position.y + w.length;
	}

	public detachForDrag(
		components: readonly Component[],
		wires: readonly Wire[]
	): void {
		for (const c of components) {
			this._components.remove(c);
		}
		for (const w of wires) {
			this._wires.remove(w);
		}
		this._ticker$.next('single');
	}

	public reattachFromDrag(
		components: readonly Component[],
		wires: readonly Wire[]
	): void {
		for (const c of components) {
			if (!c.destroyed) this._components.insert(c);
		}
		for (const w of wires) {
			if (!w.destroyed) this._wires.insert(w);
		}
		this._ticker$.next('single');
	}

	public moveComponent(id: number, pos: Point): void {
		const component = Array.from(this._components.items).find(
			(c) => c.id === id
		);
		if (!component) return;
		component.position.copyFrom(pos);
		this._components.insert(component);
		this._ticker$.next('single');
	}

	public moveWire(id: number, pos: Point): void {
		const wire = Array.from(this._wires.items).find((w) => w.id === id);
		if (!wire) return;
		wire.position.copyFrom(pos);
		this._wires.insert(wire);
		this._ticker$.next('single');
	}

	private updateScale(
		scale: number,
		center: Point = this._viewPortSize.multiplyScalar(0.5)
	) {
		if (scale === this.scale.x) return;

		this.setPosition(
			new Matrix()
				.translate(-center.x, -center.y)
				.scale(1 / this.scale.x, 1 / this.scale.y)
				.scale(scale, scale)
				.translate(center.x, center.y)
				.apply(this.position)
		);

		this.scale.set(scale);
		this._grid.updateScale(scale);
		this._floatingLayer.updateScale(scale);

		for (const child of this._components.items) {
			child.applyScale(scale);
		}
		for (const child of this._wires.items) {
			child.applyScale(scale);
		}
	}
}
