import { Container, Point, Rectangle } from 'pixi.js';

import { romComponentConfig } from '../rendering/components/rom.component';
import { Component, ComponentConfig } from '../rendering/component';
import { getStaticDI } from '../../utils/get-di';
import { PixiLoaderService } from '../../services/pixi-loader/pixi-loader.service';
import { Grid } from '../rendering/grid';

export class View extends Container {
	override sortableChildren = false;

	private _grid: Grid = new Grid();
	private _components: Component[] = [];
	private _size = new Point(0, 0);

	private _scaleStep = 0;

	constructor() {
		super();

		getStaticDI(PixiLoaderService).loaded$.subscribe(() => {
			this.addComponent(romComponentConfig, new Point(0, 0));

			// setInterval(() => {
			// 	component.options[0].value = (component.options[0].value as ElementRotation + 1) % 4
			// }, 500);
		});

		this._grid.updateViewport(new Rectangle(0, 0, 32, 32));
		this.addChild(this._grid);
	}

	public resize(width: number, height: number) {
		this._size.x = width;
		this._size.y = height;
		this._grid.updateViewport(
			new Rectangle(this.x, this.y, this._size.x, this._size.y)
		);
	}

	public pan(point: Point) {
		this.x += point.x;
		this.y += point.y;

		this._grid.updateViewport(
			new Rectangle(this.x, this.y, this._size.x, this._size.y)
		);
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
		this.updateScale(1);
	}

	private updateScale(scale: number) {
		if (scale === this.scale.x) return;

		this.scale.set(scale);

		this._grid.updateScale(this.scale.x);

		for (const child of this._components) {
			child.applyScale(this.scale.x);
		}
	}

	private addComponent(componentConfig: ComponentConfig, pos: Point) {
		const component = componentConfig.generate(
			componentConfig.options.map((x) => x.clone())
		);
		component.gridPos = pos;

		this._components.push(component);
		this.addChild(component);
	}
}
