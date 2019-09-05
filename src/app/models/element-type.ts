import * as PIXI from 'pixi.js';

export interface ElementType {
	name: string;
	symbol: string;
	description: string;
	texture: PIXI.Texture;
	generateElementTexture: (renderer: PIXI.Renderer, symbol: string) => PIXI.Texture;
}
