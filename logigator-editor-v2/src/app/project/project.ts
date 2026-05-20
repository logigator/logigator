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

	public *queryComponentsInRange(rect: Rectangle): Generator<Component> {
		yield* this._components.queryRange(rect);
	}

	public *queryWiresInRange(rect: Rectangle): Generator<Wire> {
		yield* this._wires.queryRange(rect);
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
