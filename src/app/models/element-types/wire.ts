import * as PIXI from 'pixi.js';
import {ElementType} from '../element-type';

export const wire: ElementType = {
	name: 'wire',
	numInputs: 0,
	numOutputs: 0,
	hasVariableInputs: false,
	symbol: '',
	description: '',
	texture: null,
	generateElementTexture: (renderer: PIXI.Renderer, symbol: string): PIXI.Texture => {
		// for wire this will never be implemented, because wires are drawn as needed
		return null;
	}
};
