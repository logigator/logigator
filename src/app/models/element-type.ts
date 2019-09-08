import * as PIXI from 'pixi.js';

export interface ElementType {
	name: string;
	numInputs: number;
	numOutputs: number;
	hasVariableInputs: boolean;
	symbol: string;
	description: string;
	texture: PIXI.Texture;
	generateElementTexture: (renderer: PIXI.Renderer, symbol: string) => PIXI.Texture;
}
