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
import { SelectionManager } from './selection-manager';
import { Wire } from '../wires/wire';
import { QuadTreeContainer } from '../rendering/quad-tree-container';
import { WireIntegrator } from './wire-integrator';
import { ViewportController } from './viewport-controller';
import { ConnectionPointManager } from '../connection-points/connection-point-manager';

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
		return this._wireIntegrator.integrate(
			newWires,
			(rect) => this.queryWiresInRange(rect),
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
}
