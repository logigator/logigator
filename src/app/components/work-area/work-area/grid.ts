import * as PIXI from 'pixi.js';

export class Grid {

	private static _renderer: PIXI.Renderer;

	private static _gridTexture: PIXI.Texture;

	private static GRID_CHUNK_SIZE = 40;
	private static GRID_SIZE = 20;

	public static setRenderer(renderer: PIXI.Renderer) {
		this._renderer = renderer;
	}

	public static generateGridTexture() {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0);
		for (let i = 0; i < this.GRID_CHUNK_SIZE; i++) {
			for (let j = 0; j < this.GRID_CHUNK_SIZE; j++) {
				graphics.drawRect(i * this.GRID_SIZE, j * this.GRID_SIZE, 2, 2);
			}
		}
		this._gridTexture = this._renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio * 2);
	}

	public static generateGridSprite(): PIXI.Sprite {
		return new PIXI.Sprite(this._gridTexture);
	}

	public static get gridChunkSize(): number {
		return this.GRID_SIZE * this.GRID_CHUNK_SIZE;
	}
}
