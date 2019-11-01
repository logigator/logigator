import {LGraphics} from './l-graphics';
import {ThemingService} from '../../services/theming/theming.service';
import {getStaticDI} from '../get-di';
import {environment} from '../../../environments/environment';
import * as PIXI from 'pixi.js';

export class ComponentGraphics extends LGraphics {

	private themingService = getStaticDI(ThemingService);

	private _userInputState = false;

	constructor(symbol: string, inputs: number, outputs: number, rotation: number, scale: number) {
		super();
		this.interactiveChildren = false;
		this.sortableChildren = false;
		this.drawComponent(symbol, inputs, outputs, rotation, scale);
	}

	private drawComponent(
		symbol: string,
		inputs: number,
		outputs: number,
		rotation: number,
		scale: number
	) {
		this.lineStyle(1 / scale, this.themingService.getEditorColor('wire'));
		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);

		let width;
		let height;
		if (rotation === 0 || rotation === 2) {
			width = environment.gridPixelWidth * 2;
			height = inputs >= outputs ? environment.gridPixelWidth * inputs : environment.gridPixelWidth * outputs;
		} else {
			width = inputs >= outputs ? environment.gridPixelWidth * inputs : environment.gridPixelWidth * outputs;
			height = environment.gridPixelWidth * 2;
		}
		this.drawRect(0, 0, width, height);

		this.beginFill(this.themingService.getEditorColor('wire'));

		switch (rotation) {
			case 0:
				this.leftWires(inputs, width, height);
				this.rightWires(outputs, width, height);
				break;
			case 1:
				this.topWires(inputs, width, height);
				this.bottomWires(outputs, width, height);
				break;
			case 2:
				this.rightWires(inputs, width, height);
				this.leftWires(outputs, width, height);
				break;
			case 3:
				this.bottomWires(inputs, width, height);
				this.topWires(outputs, width, height);
				break;
		}

		const text = new PIXI.BitmapText(symbol, {
			font: {
				name: 'Nunito',
				size: environment.gridPixelWidth + 4
			},
			tint: this.themingService.getEditorColor('fontTint')
		});

		text.anchor = 0.5;
		text.position.x = width / 2;
		text.position.y = height / 2;

		this.addChild(text);
	}

	private leftWires(amount: number, width: number, height: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo(0, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			this.lineTo(-environment.gridPixelWidth / 2, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	private rightWires(amount: number, width: number, height: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo(width, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			this.lineTo(width + (environment.gridPixelWidth / 2), (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	topWires(amount: number, width: number, height: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, 0);
			this.lineTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, -environment.gridPixelWidth / 2);
		}
	}

	bottomWires(amount: number, width: number, height: number) {
		for (let i = 0; i < amount; i++) {
			this.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height);
			this.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height + (environment.gridPixelWidth / 2));
		}
	}

	public updateComponent(
		symbol: string,
		inputs: number,
		outputs: number,
		rotation: number,
		scale: number
	) {
		this.removeChildren(0);
		this.drawComponent(symbol, inputs, outputs, rotation, scale);
	}

	public updateScale(scale: number) {
		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			data.lineStyle.width = 1 / scale;
		}
		this.geometry.invalidate();
	}

	public applySimState(scale: number) {
		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			data.lineStyle.width = 1 / scale;
		}
		this.geometry.invalidate();
	}

	public toggleUserInputState() {
		this._userInputState = !this._userInputState;
	}

	public get userInputState(): boolean {
		return this._userInputState;
	}
}
