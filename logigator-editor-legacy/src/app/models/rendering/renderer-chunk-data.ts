import * as PIXI from 'pixi.js';

export interface RendererChunkData {
	scaledFor: number;
	container: PIXI.Container;
	gridGraphics: PIXI.Graphics;
}
