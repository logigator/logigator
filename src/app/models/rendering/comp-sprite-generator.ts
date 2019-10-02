import * as PIXI from 'pixi.js';
import {ThemingService} from '../../services/theming/theming.service';
import {environment} from '../../../environments/environment';

export class CompSpriteGenerator {

	public static updateGraphics(symbol: string, inputs: number, outputs: number, rotation: number, scale: number, graphics: PIXI.Graphics) {
		graphics.lineStyle(1 / scale, ThemingService.staticInstance.getEditorColor('wire'));
		graphics.beginFill(ThemingService.staticInstance.getEditorColor('background'));
		graphics.moveTo(0, 0);

		let width;
		let height;
		if (rotation === 0 || rotation === 2) {
			width = environment.gridPixelWidth * 2;
			height = inputs >= outputs ? environment.gridPixelWidth * inputs : environment.gridPixelWidth * outputs;
		} else {
			width = inputs >= outputs ? environment.gridPixelWidth * inputs : environment.gridPixelWidth * outputs;
			height = environment.gridPixelWidth * 2;
		}
		graphics.drawRect(0, 0, width, height);

		graphics.beginFill(ThemingService.staticInstance.getEditorColor('wire'));

		switch (rotation) {
			case 0:
				CompSpriteGenerator.rotation0(inputs, outputs, height, width, graphics);
				break;
			case 1:
				CompSpriteGenerator.rotation1(inputs, outputs, height, width, graphics);
				break;
			case 2:
				CompSpriteGenerator.rotation2(inputs, outputs, height, width, graphics);
				break;
			case 3:
				CompSpriteGenerator.rotation3(inputs, outputs, height, width, graphics);
				break;
		}

		graphics.removeChildren(0);

		const text = new PIXI.BitmapText(symbol, {
			font: {
				name: 'Louis George Café',
				size: environment.gridPixelWidth + 4
			},
			tint: ThemingService.staticInstance.getEditorColor('fontTint')
		});

		text.anchor = 0.5;
		text.position.x = width / 2;
		text.position.y = height / 2;

		graphics.addChild(text);

		return graphics;
	}

	private static calcFontSize(length: number): number {
		if (length <= 2) return environment.gridPixelWidth + 3;
		return environment.gridPixelWidth / 1.2;
	}

	// tslint:disable-next-line:max-line-length
	public static getComponentSprite(symbol: string, inputs: number, outputs: number, rotation: number, scale: number): PIXI.Sprite | PIXI.Graphics {
		const graphics = new PIXI.Graphics();
		graphics.interactiveChildren = false;
		return CompSpriteGenerator.updateGraphics(symbol, inputs, outputs, rotation, scale, graphics);
	}

	private static rotation0(inputs: number, outputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		for (let i = 0; i < outputs; i++) {
			graphics.moveTo(width, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			graphics.lineTo(width + environment.gridPixelWidth / 2, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
		for (let i = 0; i < inputs; i++) {
			graphics.moveTo(-(environment.gridPixelWidth / 2), (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			graphics.lineTo(0, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	private static rotation1(inputs: number, outputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		for (let i = 0; i < outputs; i++) {
			graphics.moveTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, height);
			graphics.lineTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, height + environment.gridPixelWidth / 2);
		}
		for (let i = 0; i < inputs; i++) {
			graphics.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, 0);
			graphics.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, -(environment.gridPixelWidth / 2));
		}
	}

	private static rotation2(inputs: number, outputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		for (let i = 0; i < outputs; i++) {
			graphics.moveTo(0, height - (environment.gridPixelWidth / 2) - (environment.gridPixelWidth * i));
			graphics.lineTo(-(environment.gridPixelWidth / 2), height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
		}
		for (let i = 0; i < inputs; i++) {
			graphics.moveTo(width, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			graphics.lineTo(width + (environment.gridPixelWidth / 2), (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	private static rotation3(inputs: number, outputs: number, height: number, width: number, graphics: PIXI.Graphics) {
		for (let i = 0; i < outputs; i++) {
			graphics.moveTo(environment.gridPixelWidth / 2 + environment.gridPixelWidth * i, 0);
			graphics.lineTo(environment.gridPixelWidth / 2 + environment.gridPixelWidth * i, -(environment.gridPixelWidth / 2));
		}
		for (let i = 0; i < inputs; i++) {
			graphics.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height);
			graphics.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height + (environment.gridPixelWidth / 2));
		}
	}
}
