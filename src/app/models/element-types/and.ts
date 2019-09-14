import * as PIXI from 'pixi.js';
import {ElementType} from '../element-type';
import {environment} from '../../../environments/environment';
import {ThemingService} from '../../services/theming/theming.service';

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
		graphics.lineStyle(1, ThemingService.staticInstance.getEditorColor('wire'));
		graphics.beginFill(ThemingService.staticInstance.getEditorColor('background'));
		graphics.moveTo(0, 0);
		graphics.drawRect(0, 0, environment.gridPixelWidth * 2, environment.gridPixelWidth * 2);

		const text = new PIXI.BitmapText(symbol, {font: {name: 'Louis George Café', size: 40}});

		graphics.addChild(text);

		return renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, window.devicePixelRatio);
	}
};
