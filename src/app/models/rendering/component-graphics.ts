import {ThemingService} from '../../services/theming/theming.service';
import {getStaticDI} from '../get-di';
import {environment} from '../../../environments/environment';
import * as PIXI from 'pixi.js';

export class ComponentGraphics extends PIXI.Graphics {

	private themingService = getStaticDI(ThemingService);

	private _width: number;
	private _height: number;

	constructor(scale: number, inputs: number, outputs: number, rotation: number) {
		super();
		this.interactiveChildren = false;
		this.sortableChildren = false;
		this.drawComponent(inputs, outputs, rotation, scale);
	}

	private drawComponent(
		inputs: number,
		outputs: number,
		rotation: number,
		scale: number
	) {
		this.lineStyle(1, this.themingService.getEditorColor('wire'));
		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);

		if (rotation === 0 || rotation === 2) {
			this._width = environment.gridPixelWidth * 2;
			this._height = inputs >= outputs ? environment.gridPixelWidth * inputs : environment.gridPixelWidth * outputs;
		} else {
			this._width = inputs >= outputs ? environment.gridPixelWidth * inputs : environment.gridPixelWidth * outputs;
			this._height = environment.gridPixelWidth * 2;
		}
		this.drawRect(0, 0, Math.floor(this._width * scale), Math.floor(this._height * scale));

		this.beginFill(this.themingService.getEditorColor('wire'));

		switch (rotation) {
			case 0:
				this.rotation0(inputs, outputs, scale);
				break;
			case 1:
				this.rotation1(inputs, outputs, scale);
				break;
			case 2:
				this.rotation2(inputs, outputs, scale);
				break;
			case 3:
				this.rotation3(inputs, outputs, scale);
				break;
		}
	}

	private rotation0(inputs: number, outputs: number, scale: number) {
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				Math.floor(this._width * scale),
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale)
			);
			this.lineTo(
				Math.floor((this._width + environment.gridPixelWidth / 2) * scale),
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale)
			);
		}
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				Math.floor(-environment.gridPixelWidth / 2 * scale),
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale)
			);
			this.lineTo(
				0,
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale)
			);
		}
	}

	private rotation1(inputs: number, outputs: number, scale: number) {
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				Math.floor((this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i) * scale),
				Math.floor(this._height * scale)
			);
			this.lineTo(
				Math.floor((this._width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i) * scale),
				Math.floor((this._height + environment.gridPixelWidth / 2) * scale)
			);
		}
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale),
			0);
			this.lineTo(
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale),
				Math.floor(-environment.gridPixelWidth / 2 * scale)
			);
		}
	}

	private rotation2(inputs: number, outputs: number, scale: number) {
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				0,
				Math.floor((this._height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i) * scale)
			);
			this.lineTo(
				Math.floor(-environment.gridPixelWidth / 2 * scale),
				Math.floor((this._height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i) * scale)
			);
		}
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				Math.floor(this._width * scale),
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale)
			);
			this.lineTo(
				Math.floor(((this._width + environment.gridPixelWidth / 2) * scale)),
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale)
			);
		}
	}

	private rotation3(inputs: number, outputs: number, scale: number) {
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale),
				0
			);
			this.lineTo(
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale),
				Math.floor(-environment.gridPixelWidth / 2 * scale)
			);
		}
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale),
				Math.floor(this._height * scale)
			);
			this.lineTo(
				Math.floor((environment.gridPixelWidth / 2 + environment.gridPixelWidth * i) * scale),
				Math.floor((this._height + environment.gridPixelWidth / 2) * scale)
			);
		}
	}
}
