import { Container, Point } from 'pixi.js';

import { Grid } from './grid';
import { Component } from '../components/component';
import { ComponentConfig } from '../components/component-config.model';
import { ComponentRotation } from '../components/component-rotation.enum';
import { romComponentConfig } from '../components/component-types/rom/rom.config';

export class Project extends Container {
	override sortableChildren = false;

	// public meta: ProjectMeta = new ProjectMeta();

	private _grid: Grid = new Grid();
	private _components: Component[] = [];
	private _viewPortSize = new Point(0, 0);

	private _scaleStep = 0;

	constructor() {
		super();

		this.addChild(this._grid);

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

	public pan(point: Point) {
		this.x += point.x;
		this.y += point.y;

		this._grid.updatePosition(this.position);
	}

	public zoomIn() {
		if (this._scaleStep >= 7) return;

		this.updateScale(Math.pow(1.25, ++this._scaleStep));
	}

	public zoomOut() {
		if (this._scaleStep <= -7) return;

		this.updateScale(Math.pow(1.25, --this._scaleStep));
	}

	public zoom100() {
		this._scaleStep = 0;
		this.updateScale(1);
	}

	private updateScale(scale: number) {
		if (scale === this.scale.x) return;

		this.scale.set(scale);

		this._grid.updateScale(scale);

		for (const child of this._components) {
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

		this._components.push(component);
		this.addChild(component);
	}
}
