import * as PIXI from 'pixi.js';
import {ComponentType} from '../component-type';
import {environment} from '../../../environments/environment';

export const not: ComponentType = {
	name: 'not',
	symbol: '1',
	description: '',
	texture: null,
	generateComponentTexture: (renderer: PIXI.Renderer, symbol: string): PIXI.Texture => {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0xff0000);
		graphics.drawRect(0, 0, environment.gridPixelWidth * 2, environment.gridPixelWidth * 2);
		return renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio);
	}
};
