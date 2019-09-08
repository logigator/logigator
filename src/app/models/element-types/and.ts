import * as PIXI from 'pixi.js';
import {ElementType} from '../element-type';
import {environment} from '../../../environments/environment';

export const and: ElementType = {
	name: 'and',
	numInputs: 2,
	numOutputs: 1,
	hasVariableInputs: true,
	symbol: '&',
	description: '',
	texture: null,
	generateElementTexture: (renderer: PIXI.Renderer, symbol: string): PIXI.Texture => {
		const graphics = new PIXI.Graphics();
		graphics.beginFill(0xff00ff);
		graphics.drawRect(0, 0, environment.gridPixelWidth * 2, environment.gridPixelWidth * 2);
		return renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio);
	}
};
