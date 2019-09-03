import * as PIXI from 'pixi.js';
import {ComponentType} from '../component-type';

export const or: ComponentType = {
	name: 'or',
	symbol: '≥1',
	description: '',
	texture: null,
	generateComponentTexture: (renderer: PIXI.Renderer): PIXI.Texture => {
		return null;
	}
};
