import * as PIXI from 'pixi.js';
import {environment} from '../../../environments/environment';

export class Grid {

	private static _renderer: PIXI.Renderer;

	private static _gridGeometries: Map<number, PIXI.GraphicsGeometry> = new Map();

	public static setRenderer(renderer: PIXI.Renderer) {
		this._renderer = renderer;
	}

	private static getGridGeometry(scale: number): PIXI.GraphicsGeometry {
		if (this._gridGeometries.has(scale)) {
			return this._gridGeometries.get(scale);
		}
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0);
		for (let i = 0; i < environment.chunkSize; i++) {
			for (let j = 0; j < environment.chunkSize; j++) {
				graphics.drawRect(i * environment.gridPixelWidth, j * environment.gridPixelWidth, 1 / scale, 1 / scale);
			}
		}
		this._gridGeometries.set(scale, graphics.geometry);
		return graphics.geometry;
	}

	public static generateGridGraphics(scale): PIXI.Graphics {
		const graphics = new PIXI.Graphics(this.getGridGeometry(scale));
		graphics.hitArea = new PIXI.Rectangle(
			0,
			0,
			environment.chunkSize * environment.gridPixelWidth,
			environment.chunkSize * environment.gridPixelWidth
		);
		graphics.name = 'grid';
		return graphics;
	}

	public static getGridPosForPixelPos(point: PIXI.Point): PIXI.Point {
		return new PIXI.Point(Math.floor(point.x / environment.gridPixelWidth), Math.floor(point.y / environment.gridPixelWidth));
	}

	public static getPixelPosForGridPos(point: PIXI.Point): PIXI.Point {
		return new PIXI.Point(point.x * environment.gridPixelWidth, point.y * environment.gridPixelWidth);
	}

}
