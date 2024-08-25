import { Container, Matrix, Point, Rectangle } from 'pixi.js';

import { Grid } from '../rendering/grid';
import { ComponentConfig } from '../components/component-config.model';
import { InteractionContainer } from '../rendering/interaction-container';
import { Component } from '../components/component';
import { Observable, Subject } from 'rxjs';
import { toGridPoint } from '../utils/grid';
import { WorkMode } from '../work-mode/work-mode.enum';
import { FloatingLayer } from '../rendering/floating-layer';

export class Project extends InteractionContainer {
	private readonly _scaleStepAmount = 1.2;
	private readonly _scaleStepMin = -12;
	private readonly _scaleStepMax = 5;
	private _scaleStep = 0;

	private readonly _grid: Grid = new Grid();
	private readonly _components = new Container<Component>();
	private readonly _floatingLayer = new FloatingLayer(this, this._ticker$);

	private _viewPortSize = new Point(0, 0);
	private _mode: WorkMode = WorkMode.WIRE_DRAWING;
	private _componentToPlace: ComponentConfig | null = null;

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

		this.addChild(this._grid);
		this.addChild(this._components);
		this.addChild(this._floatingLayer);
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
		this.updateScale(Math.pow(this._scaleStepAmount, ++this._scaleStep), center);
	}

	public zoomOut(center?: Point) {
		if (this._scaleStep <= this._scaleStepMin) return;
		this.updateScale(Math.pow(this._scaleStepAmount, --this._scaleStep), center);
	}

	public zoom100(center?: Point) {
		this._scaleStep = 0;
		this.updateScale(1, center);
	}

	public get positionChange$(): Observable<Point> {
		return this._positionChange$.asObservable();
	}

	public get gridPosition() {
		return toGridPoint(this.position.multiplyScalar(1 / this.scale.x), true);
	}

	public get mode(): WorkMode {
		return this._mode;
	}

	public set mode(mode: WorkMode) {
		this._mode = mode;
	}

	public get componentToPlace(): ComponentConfig | null {
		return this._componentToPlace;
	}

	public set componentToPlace(component: ComponentConfig | null) {
		this._componentToPlace = component;
	}

	private updateScale(scale: number, center: Point = this._viewPortSize.multiplyScalar(0.5)) {
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

		for (const child of this._components.children) {
			child.applyScale(scale);
		}
	}

	public addComponent(component: Component, gridPos?: Point) {
		if (gridPos) {
			component.gridPos = gridPos;
		}
		component.applyScale(this.scale.x);

		this._components.addChild(component);

		this._ticker$.next('single');
	}

	public removeComponent(componentId: number) {
		// TODO: Implement
		throw new Error('Not implemented');
	}
}
