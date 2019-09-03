import * as PIXI from 'pixi.js';
import {ComponentType} from '../component-type';

export const xor: ComponentType = {
	name: 'xor',
	symbol: '=1',
	description: '',
	texture: null,
	generateComponentTexture: (renderer: PIXI.Renderer): PIXI.Texture => {
		return null;
	}
};
