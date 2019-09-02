import * as PIXI from 'pixi.js';
import {ComponentType} from '../component-type';

export const wire: ComponentType = {
	name: 'wire',
	symbol: '',
	description: '',
	texture: null,
	generateComponentTexture: (renderer: PIXI.Renderer): PIXI.Texture => {
		// for wire this will never be implemented, because wires are drawn as needed
		return null;
	}
};
