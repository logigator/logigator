import { Container, Point, Rectangle } from 'pixi.js';

import { Grid } from '../rendering/grid';
import { ComponentConfig } from '../components/component-config.model';
import { InteractionContainer } from '../rendering/interaction-container';
import { Component } from '../components/component';
import { Observable, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { WorkMode } from '../work-mode/work-mode.enum';
import { FloatingLayer } from '../rendering/floating-layer';
import { ActionManager } from '../actions/action-manager';
import { ActionContainer } from '../actions/action-container';
import { SelectionManager } from './selection-manager';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { QuadTreeContainer } from '../rendering/quad-tree-container';
import { WireIntegrator, IntegrationInput, IntegrationOutput } from './wire-integrator';
import { ViewportController } from './viewport-controller';
import { ConnectionPointManager } from '../connection-points/connection-point-manager';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';

export class Project extends InteractionContainer {
	public readonly actionManager = new ActionManager(this);
	public readonly selectionManager = new SelectionManager(this);

	private readonly _grid: Grid = new Grid();
	private readonly _gridSpace = new Container();
	private readonly _wires = new QuadTreeContainer<Wire>();
	private readonly _components = new QuadTreeContainer<Component>();
	private readonly _floatingLayer = new FloatingLayer(this);

	private readonly _wireIntegrator = new WireIntegrator();
	private readonly _viewport: ViewportController;

	private readonly _connectionPoints = new ConnectionPointManager(
		(rect) => this.queryWiresInRange(rect),
		(rect) => this.queryComponentsInRange(rect),
		() => this.scale.x
	);
	private readonly _portsChangeSubs = new Map<number, Subscription>();

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
		this._gridSpace.addChild(this._connectionPoints.layer);
		this._gridSpace.addChild(this._floatingLayer);

		this._viewport = new ViewportController(this, this._grid, (scale) => {
			this._floatingLayer.updateScale(scale);
			this._connectionPoints.layer.applyScale(scale);
			for (const child of this._components.items) {
				child.applyScale(scale);
			}
			for (const child of this._wires.items) {
				child.applyScale(scale);
			}
		});
	}

	public get gridSpace(): Container {
		return this._gridSpace;
	}

	public get connectionPoints(): ConnectionPointManager {
		return this._connectionPoints;
	}

	public resizeViewport(width: number, height: number): void {
		this._viewport.resizeViewport(width, height);
	}

	public pan(point: Point): void {
		this._viewport.pan(point);
	}

	public setPosition(point: Point): void {
		this._viewport.setPosition(point);
	}

	public zoomIn(center?: Point): void {
		this._viewport.zoomIn(center);
	}

	public zoomOut(center?: Point): void {
		this._viewport.zoomOut(center);
	}

	public get zoomInPossible(): boolean {
		return this._viewport.zoomInPossible;
	}

	public get zoomOutPossible(): boolean {
		return this._viewport.zoomOutPossible;
	}

	public zoom100(center?: Point): void {
		this._viewport.zoom100(center);
	}

	public get positionChange$(): Observable<Point> {
		return this._viewport.positionChange$;
	}

	public get gridPosition(): Point {
		return this._viewport.gridPosition;
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
		this._connectionPoints.onComponentAdded(component.connectionPoints);
		this._portsChangeSubs.set(
			component.id,
			component.portsChange$.subscribe(({ oldPorts, newPorts }) => {
				// Rotation/port-count changes can leave a wire's interior crossing a
				// new port position (I2 violation) or unblock a previously-blocked
				// collinear merge at an old port. Run the integrator to restore
				// invariants. Note: this path bypasses ActionManager, so the implied
				// wire splits/merges are NOT undoable. Rotation itself was already
				// not undoable before this refactor; full undo support is tracked
				// as a future task (see wire-connection-refactor.md Phase 4).
				const { toAdd, toRemove } = this.computeIntegration({
					movedComponentPorts: [{ oldPorts, newPorts }]
				});
				for (const w of toRemove) this.removeWire(w.id);
				for (const w of toAdd) this.addWire(w);

				this._connectionPoints.onComponentRemoved(oldPorts);
				this._connectionPoints.onComponentAdded(newPorts);
				this._ticker$.next('single');
			})
		);
		this._ticker$.next('single');
	}

	public removeComponent(componentId: number) {
		const component = Array.from(this._components.items).find(
			(c) => c.id === componentId
		);
		if (!component) return;
		this.selectionManager.evict(component);
		const ports = component.connectionPoints;
		this._components.remove(component);
		this._connectionPoints.onComponentRemoved(ports);
		this._portsChangeSubs.get(componentId)?.unsubscribe();
		this._portsChangeSubs.delete(componentId);
		component.destroy({ children: true });
		this._ticker$.next('single');
	}

	public addWire(wire: Wire) {
		wire.applyScale(this.scale.x);
		this._wires.insert(wire);
		this._connectionPoints.onWireAdded(Wire.snapshot(wire));
		this._ticker$.next('single');
	}

	public removeWire(wireId: number) {
		const wire = Array.from(this._wires.items).find((w) => w.id === wireId);
		if (!wire) return;
		this.selectionManager.evict(wire);
		const snapshot = Wire.snapshot(wire);
		this._wires.remove(wire);
		this._connectionPoints.onWireRemoved(snapshot);
		wire.destroy();
		this._ticker$.next('single');
	}

	public hasComponentCollision(
		bounds: Rectangle,
		bodyBounds: Rectangle,
		excludeIds: ReadonlySet<number> = new Set()
	): boolean {
		for (const comp of this.queryComponentsInRange(bounds)) {
			if (excludeIds.has(comp.id)) continue;
			// Allow stub-on-stub overlap (e.g. perpendicular wire ends meeting at a
			// corner). Only block if a body intersects the other component's full
			// extent (body + stubs), which catches body-body, body-stub, stub-body.
			if (
				bodyBounds.intersects(comp.gridBounds) ||
				bounds.intersects(comp.bodyGridBounds)
			)
				return true;
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

	public computeIntegration(input: IntegrationInput): IntegrationOutput {
		return this._wireIntegrator.integrate(
			input,
			(rect) => this.queryWiresInRange(rect),
			(rect) => this.queryComponentsInRange(rect),
			this.scale.x
		);
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
		const oldPorts = component.connectionPoints;
		component.position.copyFrom(pos);
		this._components.insert(component);
		this._connectionPoints.onComponentRemoved(oldPorts);
		this._connectionPoints.onComponentAdded(component.connectionPoints);
		this._ticker$.next('single');
	}

	public moveWire(id: number, pos: Point): void {
		const wire = Array.from(this._wires.items).find((w) => w.id === id);
		if (!wire) return;
		const oldSnap = Wire.snapshot(wire);
		wire.position.copyFrom(pos);
		this._wires.insert(wire);
		this._connectionPoints.onWireRemoved(oldSnap);
		this._connectionPoints.onWireAdded(Wire.snapshot(wire));
		this._ticker$.next('single');
	}

	public toggleConnectionAt(p: Point): void {
		if (this._connectionPoints.hasCpAt(p)) {
			this._joinAt(p);
		} else {
			this._splitAt(p);
		}
	}

	private _joinAt(p: Point): void {
		const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
		const hWires: Wire[] = [];
		const vWires: Wire[] = [];

		for (const w of this.queryWiresInRange(queryRect)) {
			const [s, e] = w.connectionPoints;
			if ((s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y)) {
				if (w.direction === WireDirection.HORIZONTAL) hWires.push(w);
				else vWires.push(w);
			}
		}

		const addedWires: Wire[] = [];
		const removedWires: Wire[] = [];

		if (hWires.length === 2) {
			removedWires.push(...hWires);
			addedWires.push(Wire.merge(hWires[0], hWires[1]));
		}

		if (vWires.length === 2) {
			removedWires.push(...vWires);
			addedWires.push(Wire.merge(vWires[0], vWires[1]));
		}

		if (addedWires.length === 0) return;

		const { toAdd, toRemove } = this.computeIntegration({
			addedWires,
			removedWires
		});

		const blocked = toAdd.some((w) => {
			const [s, e] = w.connectionPoints;
			return (s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y);
		});

		const cleanup = () => {
			for (const w of addedWires) if (!w.destroyed) w.destroy();
			for (const w of toAdd) if (!w.destroyed) w.destroy();
		};

		if (blocked) {
			cleanup();
			return;
		}

		const action = new ActionContainer();
		if (toRemove.length > 0) action.add(new RemoveWiresAction(...toRemove));
		if (toAdd.length > 0) action.add(new AddWiresAction(...toAdd));
		cleanup();
		this.actionManager.push(action);
	}

	private _splitAt(p: Point): void {
		const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
		let hWire: Wire | null = null;
		let vWire: Wire | null = null;

		for (const w of this.queryWiresInRange(queryRect)) {
			if (!w.contains(p)) continue;
			const [s, e] = w.connectionPoints;
			if ((s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y))
				continue;
			if (w.direction === WireDirection.HORIZONTAL) hWire = w;
			else vWire = w;
		}

		if (!hWire || !vWire) return;

		const [hLeft, hRight] = Wire.split(hWire, p);
		const [vTop, vBottom] = Wire.split(vWire, p);

		const addedWires = [hLeft, hRight, vTop, vBottom];
		const removedWires = [hWire, vWire];

		const { toAdd, toRemove } = this.computeIntegration({
			addedWires,
			removedWires
		});

		const action = new ActionContainer();
		if (toRemove.length > 0) action.add(new RemoveWiresAction(...toRemove));
		if (toAdd.length > 0) action.add(new AddWiresAction(...toAdd));
		for (const w of addedWires) if (!w.destroyed) w.destroy();
		this.actionManager.push(action);
	}
}
