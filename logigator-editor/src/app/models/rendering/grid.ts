// @ts-strict-ignore
import * as PIXI from 'pixi.js';
import { environment } from '../../../environments/environment';
import Point = PIXI.Point;
import { ThemingService } from '../../services/theming/theming.service';
import { getStaticDI } from '../get-di';

export class Grid {
	private static _gridGeometries: Map<number, PIXI.GraphicsGeometry> =
		new Map();
	private static _showChunks = false;

	private static getGridGeometry(scale: number): PIXI.GraphicsGeometry {
		if (this._gridGeometries.has(scale)) {
			return this._gridGeometries.get(scale);
		}
		const graphics = new PIXI.Graphics();
		graphics.beginFill(getStaticDI(ThemingService).getEditorColor('grid'));
		for (let i = 0; i < environment.chunkSize; i++) {
			for (let j = 0; j < environment.chunkSize; j++) {
				graphics.drawRect(
					i * environment.gridPixelWidth,
					j * environment.gridPixelWidth,
					1 / scale,
					1 / scale
				);
			}
		}
		if (this._showChunks) {
			graphics.beginFill(0, 0);
			graphics.lineStyle(1 / scale, 0xffffff);
			graphics.drawRect(
				0,
				0,
				environment.gridPixelWidth * environment.chunkSize,
				environment.gridPixelWidth * environment.chunkSize
			);
		}
		this._gridGeometries.set(scale, graphics.geometry);
		return graphics.geometry;
	}

	public static showChunks(visible: boolean) {
		this._gridGeometries.clear();
		this._showChunks = visible;
	}

	public static get chunksVisible() {
		return this._showChunks;
	}

	public static generateGridGraphics(scale: number): PIXI.Graphics {
		return new PIXI.Graphics(this.getGridGeometry(scale));
	}

	public static getGridPosForPixelPos(point: PIXI.IPoint): PIXI.Point {
		return new PIXI.Point(
			Math.floor(point.x / environment.gridPixelWidth),
			Math.floor(point.y / environment.gridPixelWidth)
		);
	}

	public static getFloatGridPosForPixelPos(point: PIXI.IPoint): PIXI.Point {
		return new PIXI.Point(
			point.x / environment.gridPixelWidth,
			point.y / environment.gridPixelWidth
		);
	}

	public static getPixelPosForGridPos(point: PIXI.IPoint): PIXI.Point {
		return new PIXI.Point(
			point.x * environment.gridPixelWidth,
			point.y * environment.gridPixelWidth
		);
	}

	public static getLocalChunkPixelPosForGridPos(point: PIXI.Point): PIXI.Point {
		const newPoint = point.clone();
		newPoint.x %= environment.chunkSize;
		newPoint.y %= environment.chunkSize;
		return Grid.getPixelPosForGridPos(newPoint);
	}

	public static getLocalChunkPixelPosForGridPosWire(
		point: PIXI.Point
	): PIXI.Point {
		const newPoint = point.clone();
		newPoint.x += 0.5;
		newPoint.y += 0.5;
		return Grid.getLocalChunkPixelPosForGridPos(newPoint);
	}

	public static getPixelPosForGridPosWire(point: PIXI.IPoint): PIXI.Point {
		return Grid.getPixelPosForGridPos(new Point(point.x + 0.5, point.y + 0.5));
	}

	public static getPixelPosForPixelPosOnGridWire(
		point: PIXI.IPoint
	): PIXI.Point {
		const gridPos = Grid.getGridPosForPixelPos(point);
		gridPos.x += 0.5;
		gridPos.y += 0.5;
		return Grid.getPixelPosForGridPos(gridPos);
	}

	public static getPixelPosOnGridForPixelPos(point: PIXI.IPoint): PIXI.Point {
		const gridPos = Grid.getGridPosForPixelPos(point);
		return Grid.getPixelPosForGridPos(gridPos);
	}
}
