import * as PIXI from 'pixi.js';

export interface ComponentType {
	name: string;
	symbol: string;
	description: string;
	texture: PIXI.Texture;
	generateComponentTexture: (renderer: PIXI.Renderer) => PIXI.Texture;
}
