import { Container, Point, Rectangle } from 'pixi.js';

import { Grid } from './grid';
import { ComponentConfig } from '../components/component-config.model';
import { ComponentRotation } from '../components/component-rotation.enum';
import { romComponentConfig } from '../components/component-types/rom/rom.config';
import { InteractionContainer } from './interaction-container';
import { Component } from '../components/component';

export class Project extends InteractionContainer {
	// public meta: ProjectMeta = new ProjectMeta();

	private readonly _grid: Grid = new Grid();
	private readonly _components = new Container<Component>();
	private _viewPortSize = new Point(0, 0);

	private _scaleStep = 0;

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

		this.addComponent(
			romComponentConfig,
			new Point(0, 0),
			ComponentRotation.Right
		);

		this.addComponent(
			romComponentConfig,
			new Point(5, 0),
			ComponentRotation.Right
		);

		this.addComponent(
			romComponentConfig,
			new Point(10, 0),
			ComponentRotation.Right
		);

		this.addComponent(
			romComponentConfig,
			new Point(15, 0),
			ComponentRotation.Right
		);

		this.addComponent(
			romComponentConfig,
			new Point(0, 8),
			ComponentRotation.Right
		);

		this.addComponent(
			romComponentConfig,
			new Point(10, 8),
			ComponentRotation.Down
		);

		this.addComponent(
			romComponentConfig,
			new Point(15, 13),
			ComponentRotation.Left
		);

		this.addComponent(
			romComponentConfig,
			new Point(17, 13),
			ComponentRotation.Up
		);
	}

	public resizeViewport(width: number, height: number) {
		this._viewPortSize.set(width, height);
		this._grid.resizeViewport(this._viewPortSize);
	}

	public pan(point: Point): void {
		this.setPosition(point.add(this.position));
	}

	public setPosition(point: Point): void {
		this.x = point.x;
		this.y = point.y;

		this._grid.updatePosition(this.position);
	}

	public zoomIn(center?: Point) {
		if (this._scaleStep >= 7) return;

		this.updateScale(Math.pow(1.25, ++this._scaleStep), center);
	}

	public zoomOut(center?: Point) {
		if (this._scaleStep <= -7) return;

		this.updateScale(Math.pow(1.25, --this._scaleStep), center);
	}

	public zoom100() {
		this._scaleStep = 0;
		this.updateScale(1);
	}

	private updateScale(scale: number, center?: Point) {
		if (scale === this.scale.x) return;

		if (center) {
			const dist = new Point(
				center.x - this.position.x,
				center.y - this.position.y
			);

			const scaleChange = scale - this.scale.x;

			this.pan(
				new Point(
					-dist.x * scaleChange,
					-dist.y * scaleChange
				)
			);
		}

		this.scale.set(scale);

		this._grid.updateScale(scale);

		for (const child of this._components.children) {
			child.applyScale(scale);
		}
	}

	private addComponent(
		componentConfig: ComponentConfig,
		gridPos: Point,
		direction: ComponentRotation = ComponentRotation.Right
	) {
		// TODO: Remove this check once all components have been implemented
		if (!componentConfig.implementation || !componentConfig.options) {
			return;
		}

		const component = new componentConfig.implementation(
			componentConfig.options.map((x) => x.clone())
		);
		component.gridPos = gridPos;
		component.direction = direction;

		this._components.children.push(component);
		this._components.addChild(component);
	}
}
