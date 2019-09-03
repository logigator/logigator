import * as PIXI from 'pixi.js';
import {ComponentType} from '../component-type';
import {environment} from '../../../environments/environment';

export const and: ComponentType = {
	name: 'and',
	symbol: '&',
	description: '',
	texture: null,
	generateComponentTexture: (renderer: PIXI.Renderer, symbol: string): PIXI.Texture => {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0);
		graphics.drawRect(0, 0, environment.gridPixelWidth * 2, environment.gridPixelWidth * 2);
		return renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio);
	}
};
