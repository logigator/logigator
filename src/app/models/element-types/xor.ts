import * as PIXI from 'pixi.js';
import {ElementType} from '../element-type';
import {environment} from '../../../environments/environment';

export const xor: ElementType = {
	name: 'xor',
	symbol: '=1',
	description: '',
	texture: null,
	generateElementTexture: (renderer: PIXI.Renderer, symbol: string): PIXI.Texture => {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0x0000ff);
		graphics.drawRect(0, 0, environment.gridPixelWidth * 2, environment.gridPixelWidth * 2);
		return renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio);
	}
};
