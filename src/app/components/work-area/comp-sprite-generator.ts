import * as PIXI from 'pixi.js';
import {ThemingService} from '../../services/theming/theming.service';
import {environment} from '../../../environments/environment';

export class CompSpriteGenerator {

	public static getComponentSprite(symbol: string, inputs: number, rotaion: number, scale: number): PIXI.Sprite | PIXI.Graphics {
		const graphics = new PIXI.Graphics();
		graphics.lineStyle(1 / scale, ThemingService.staticInstance.getEditorColor('wire'));
		graphics.beginFill(ThemingService.staticInstance.getEditorColor('background'));
		graphics.moveTo(0, 0);

		let width;
		let height;
		if (rotaion === 0 || rotaion === 2) {
			width = environment.gridPixelWidth * 2;
			height = environment.gridPixelWidth * inputs;
		} else {
			width = environment.gridPixelWidth * inputs;
			height = environment.gridPixelWidth * 2;
		}
		graphics.drawRect(0, 0, width, height);

		graphics.beginFill(ThemingService.staticInstance.getEditorColor('wire'));

		switch (rotaion) {
			case 0:
				CompSpriteGenerator.rotation0(inputs, height, width, graphics);
				break;
			case 1:
				CompSpriteGenerator.rotation1(inputs, height, width, graphics);
				break;
			case 2:
				CompSpriteGenerator.rotation2(inputs, height, width, graphics);
				break;
			case 3:
				CompSpriteGenerator.rotation3(inputs, height, width, graphics);
				break;
		}

		const text = new PIXI.BitmapText(symbol, {
			font: {
				name: 'Louis George Café',
				size: environment.gridPixelWidth + 4
			}
		});

		text.position.x = (width / 2) - 5;
		text.position.y = (height / 2) - 13;

		graphics.addChild(text);

		return graphics;
	}

	private static rotation0(inputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		graphics.moveTo(width, environment.gridPixelWidth / 2);
		graphics.lineTo(width + environment.gridPixelWidth / 2, environment.gridPixelWidth / 2);

		for (let i = 0; i < inputs; i++) {
			graphics.moveTo(-(environment.gridPixelWidth / 2), (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			graphics.lineTo(0, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	private static rotation1(inputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		graphics.moveTo((inputs - 1) * environment.gridPixelWidth + environment.gridPixelWidth / 2, height);
		graphics.lineTo((inputs - 1) * environment.gridPixelWidth + environment.gridPixelWidth / 2, height + environment.gridPixelWidth / 2);

		for (let i = 0; i < inputs; i++) {
			graphics.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, 0);
			graphics.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, -(environment.gridPixelWidth / 2));
		}
	}

	private static rotation2(inputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		graphics.moveTo(0, (environment.gridPixelWidth * (inputs - 1)) + (environment.gridPixelWidth / 2));
		graphics.lineTo(-(environment.gridPixelWidth / 2), (environment.gridPixelWidth * (inputs - 1)) + (environment.gridPixelWidth / 2));

		for (let i = 0; i < inputs; i++) {
			graphics.moveTo(width, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			graphics.lineTo(width + (environment.gridPixelWidth / 2), (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	private static rotation3(inputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		graphics.moveTo(environment.gridPixelWidth / 2, 0);
		graphics.lineTo(environment.gridPixelWidth / 2, -(environment.gridPixelWidth / 2));

		for (let i = 0; i < inputs; i++) {
			graphics.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height);
			graphics.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height + (environment.gridPixelWidth / 2));
		}
	}
}
