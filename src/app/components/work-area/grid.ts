import * as PIXI from 'pixi.js';

export class Grid {

	private static _renderer: PIXI.Renderer;

	private static _gridTexture: PIXI.Texture;

	private static _gridChunkSize: number;

	private static GRID_WIDTH_HEIGHT = 20;

	public static setRenderer(renderer: PIXI.Renderer) {
		this._renderer = renderer;
	}

	public static setChunkSize(size: number) {
		this._gridChunkSize = size;
	}

	public static generateGridTexture() {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0);
		for (let i = 0; i < this._gridChunkSize; i++) {
			for (let j = 0; j < this._gridChunkSize; j++) {
				graphics.drawRect(i * this.GRID_WIDTH_HEIGHT, j * this.GRID_WIDTH_HEIGHT, 2, 2);
			}
		}
		this._gridTexture = this._renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio * 2);
	}

	public static generateGridSprite(): PIXI.Sprite {
		return new PIXI.Sprite(this._gridTexture);
	}

	public static getGridPosForPixelPos(x: number, y: number): {x: number, y: number} {
		return {
			x: Math.round(x / this.GRID_WIDTH_HEIGHT),
			y: Math.round(y / this.GRID_WIDTH_HEIGHT)
		};
	}

}
