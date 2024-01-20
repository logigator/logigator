import { Container, Point } from 'pixi.js';

import { romComponentConfig } from '../rendering/components/rom.component';
import { Component, ComponentConfig } from '../rendering/component';
import { getStaticDI } from '../../utils/get-di';
import { PixiLoaderService } from '../../services/pixi-loader/pixi-loader.service';
import { Grid } from '../rendering/grid';
import { ElementRotation } from '../../models/element-rotation';
import { RenderTicker } from '../../services/render-ticker/render-ticker.service';
import { ProjectMeta } from './project-meta';

export class Project extends Container {
	override sortableChildren = false;

	public meta: ProjectMeta = new ProjectMeta();

	private _grid: Grid = new Grid();
	private _components: Component[] = [];
	private _viewPortSize = new Point(0, 0);

	private _scaleStep = 0;

	constructor() {
		super();

		getStaticDI(PixiLoaderService).loaded$.subscribe(() => {
			this.addComponent(
				romComponentConfig,
				new Point(0, 0),
				ElementRotation.Right
			);

			this.addComponent(
				romComponentConfig,
				new Point(5, 0),
				ElementRotation.Right
			);

			this.addComponent(
				romComponentConfig,
				new Point(10, 0),
				ElementRotation.Right
			);

			this.addComponent(
				romComponentConfig,
				new Point(15, 0),
				ElementRotation.Right
			);

			this.addComponent(
				romComponentConfig,
				new Point(0, 8),
				ElementRotation.Right
			);

			this.addComponent(
				romComponentConfig,
				new Point(10, 8),
				ElementRotation.Down
			);

			this.addComponent(
				romComponentConfig,
				new Point(15, 13),
				ElementRotation.Left
			);

			this.addComponent(
				romComponentConfig,
				new Point(17, 13),
				ElementRotation.Up
			);

			getStaticDI(RenderTicker).singleFrame('0');

			// setInterval(() => {
			// 	component.options[0].value = (component.options[0].value as ElementRotation + 1) % 4
			// }, 500);
		});

		this.addChild(this._grid);
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
		direction: ElementRotation = ElementRotation.Right
	) {
		const component = componentConfig.generate(
			componentConfig.options.map((x) => x.clone())
		);
		component.gridPos = gridPos;
		component.direction = direction;

		this._components.push(component);
		this.addChild(component);
	}
}
