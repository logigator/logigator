import * as PIXI from 'pixi.js';
import {environment} from '../../../environments/environment';
import Point = PIXI.Point;

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
				graphics.drawRect(i * environment.gridPixelWidth, j * environment.gridPixelWidth, 1 / scale / window.devicePixelRatio, 1 / scale / window.devicePixelRatio);
			}
		}
		// graphics.drawRect(0, 0, 1, 20 * 20)
		// graphics.drawRect(0, 0, 20 * 20, 1)
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
		return graphics;
	}

	public static getGridPosForPixelPos(point: PIXI.Point): PIXI.Point {
		return new PIXI.Point(Math.floor(point.x / environment.gridPixelWidth), Math.floor(point.y / environment.gridPixelWidth));
	}

	public static getPixelPosForGridPos(point: PIXI.Point): PIXI.Point {
		return new PIXI.Point(point.x * environment.gridPixelWidth, point.y * environment.gridPixelWidth);
	}

	public static getLocalChunkPixelPosForGridPos(point: PIXI.Point): PIXI.Point {
		const newPoint = point.clone();
		newPoint.x %= environment.chunkSize;
		newPoint.y %= environment.chunkSize;
		return Grid.getPixelPosForGridPos(newPoint);
	}

	public static getLocalChunkPixelPosForGridPosWireStart(point: PIXI.Point): PIXI.Point {
		const newPoint = point.clone();
		newPoint.x += 0.5;
		newPoint.y += 0.5;
		return Grid.getLocalChunkPixelPosForGridPos(newPoint);
	}

	public static getPixelPosForGridPosWire(point: PIXI.Point): PIXI.Point {
		return Grid.getPixelPosForGridPos(new Point(point.x + 0.5, point.y + 0.5));
	}

	public static getPixelPosForPixelPosOnGridWire(point: PIXI.Point): PIXI.Point {
		const gridPos = Grid.getGridPosForPixelPos(point);
		gridPos.x += 0.5;
		gridPos.y += 0.5;
		return Grid.getPixelPosForGridPos(gridPos);
	}

	public static getPixelPosOnGridForPixelPos(point: PIXI.Point): PIXI.Point {
		const gridPos = Grid.getGridPosForPixelPos(point);
		return Grid.getPixelPosForGridPos(gridPos);
	}

}
