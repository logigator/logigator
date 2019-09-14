import * as PIXI from 'pixi.js';
import {ElementType} from '../element-type';
import {environment} from '../../../environments/environment';

export const not: ElementType = {
	name: 'not',
	numInputs: 1,
	numOutputs: 1,
	hasVariableInputs: false,
	symbol: '1',
	description: '',
	texture: null,
	generateElementTexture: (renderer: PIXI.Renderer, symbol: string): PIXI.Texture => {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0xff0000);
		graphics.drawRect(0, 0, environment.gridPixelWidth * 2, environment.gridPixelWidth);
		return renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio);
	}
};
