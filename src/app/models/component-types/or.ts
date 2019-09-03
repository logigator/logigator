import * as PIXI from 'pixi.js';
import {ComponentType} from '../component-type';
import {environment} from '../../../environments/environment';

export const or: ComponentType = {
	name: 'or',
	symbol: '≥1',
	description: '',
	texture: null,
	generateComponentTexture: (renderer: PIXI.Renderer, symbol: string): PIXI.Texture => {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0x00ff00);
		graphics.drawRect(0, 0, environment.gridPixelWidth * 2, environment.gridPixelWidth * 2);
		return renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio);
	}
};
