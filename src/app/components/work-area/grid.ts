import * as PIXI from 'pixi.js';
import {environment} from '../../../environments/environment';

export class Grid {

	private static _renderer: PIXI.Renderer;

	private static _gridTexture: PIXI.Texture;

	public static setRenderer(renderer: PIXI.Renderer) {
		this._renderer = renderer;
	}

	public static generateGridTexture() {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0);
		for (let i = 0; i < environment.chunkSize; i++) {
			for (let j = 0; j < environment.chunkSize; j++) {
				graphics.drawRect(i * environment.gridPixelWidth, j * environment.gridPixelWidth, 1.5, 1.5);
			}
		}
		this._gridTexture = this._renderer.generateTexture(
			graphics,
			PIXI.SCALE_MODES.LINEAR,
			window.devicePixelRatio * 1.5,
			new PIXI.Rectangle(0, 0, environment.chunkSize * environment.gridPixelWidth + 2, environment.chunkSize * environment.gridPixelWidth + 2)
		);
	}

	public static generateGridSprite(): PIXI.Sprite {
		return new PIXI.Sprite(this._gridTexture);
	}

	public static getGridPosForPixelPos(point: PIXI.Point): PIXI.Point {
		return new PIXI.Point(Math.round(point.x / environment.gridPixelWidth), Math.round(point.y / environment.gridPixelWidth));
	}

	public static getPixelPosForGridPos(point: PIXI.Point): PIXI.Point {
		return new PIXI.Point(point.x * environment.gridPixelWidth, point.y * environment.gridPixelWidth);
	}

}
