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
				this.leftWires(inputs, this._width, this._height, scale);
				this.rightWires(outputs, this._width, this._height, scale);
				break;
			case 1:
				this.topWires(inputs, this._width, this._height, scale);
				this.bottomWires(outputs, this._width, this._height, scale);
				break;
			case 2:
				this.rightWires(inputs, this._width, this._height, scale);
				this.leftWires(outputs, this._width, this._height, scale);
				break;
			case 3:
				this.bottomWires(inputs, this._width, this._height, scale);
				this.topWires(outputs, this._width, this._height, scale);
				break;
		}
	}

	private leftWires(amount: number, width: number, height: number, scale: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo(
				0,
				Math.floor(((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i) * scale)
			);
			this.lineTo(
				Math.floor(-environment.gridPixelWidth / 2 * scale),
				Math.floor(((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i) * scale)
			);
		}
	}

	private rightWires(amount: number, width: number, height: number, scale: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo(
				Math.floor(width * scale),
				Math.floor(((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i) * scale)
			);
			this.lineTo(
				Math.floor((width + (environment.gridPixelWidth / 2)) * scale),
				Math.floor(((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i) * scale)
			);
		}
	}

	private topWires(amount: number, width: number, height: number, scale: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo(
				Math.floor((width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i) * scale),
				0
			);
			this.lineTo(
				Math.floor((width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i) * scale),
				Math.floor(-environment.gridPixelWidth / 2 * scale)
			);
		}
	}

	private bottomWires(amount: number, width: number, height: number, scale: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo(
				Math.floor(((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i) * scale),
				Math.floor(height * scale)
			);
			this.lineTo(
				Math.floor(((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i) * scale),
				Math.floor( (height + (environment.gridPixelWidth / 2)) * scale)
			);
		}
	}
}
