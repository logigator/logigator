import * as PIXI from 'pixi.js';
import {ComponentType} from '../component-type';

export const and: ComponentType = {
	name: 'and',
	symbol: '&',
	description: '',
	texture: null,
	generateComponentTexture: (renderer: PIXI.Renderer): PIXI.Texture => {
		return null;
	}
};
