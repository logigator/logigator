import {LGraphics} from './l-graphics';
import {ThemingService} from '../../services/theming/theming.service';
import {getStaticDI} from '../get-di';
import {environment} from '../../../environments/environment';
import * as PIXI from 'pixi.js';
import {WireGraphics} from './wire-graphics';

export class ComponentGraphics extends LGraphics {

	private themingService = getStaticDI(ThemingService);

	private _userInputState = false;

	private _miniWires: WireGraphics[] = [];

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
				this.leftWires(inputs, width, height, scale);
				this.rightWires(outputs, width, height, scale);
				break;
			case 1:
				this.topWires(inputs, width, height, scale);
				this.bottomWires(outputs, width, height, scale);
				break;
			case 2:
				this.rightWires(inputs, width, height, scale);
				this.leftWires(outputs, width, height, scale);
				break;
			case 3:
				this.bottomWires(inputs, width, height, scale);
				this.topWires(outputs, width, height, scale);
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

	private leftWires(amount: number, width: number, height: number, scale) {
		for (let i = 0; i < amount; i++) {
			const miniWire = new WireGraphics();
			miniWire.lineStyle(1 / scale, this.themingService.getEditorColor('wire'));
			miniWire.position.x = 0;
			miniWire.position.y = (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i;
			miniWire.moveTo(0, 0);
			miniWire.lineTo(-environment.gridPixelWidth / 2, 0);
			this.addChild(miniWire);
			this._miniWires.push(miniWire);
		}
	}

	private rightWires(amount: number, width: number, height: number, scale) {
		for (let i = 0; i < amount; i++) {
			const miniWire = new WireGraphics();
			miniWire.lineStyle(1 / scale, this.themingService.getEditorColor('wire'));
			miniWire.position.x = width;
			miniWire.position.y = (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i;
			miniWire.moveTo(0, 0);
			miniWire.lineTo(environment.gridPixelWidth / 2, 0);
			this.addChild(miniWire);
			this._miniWires.push(miniWire);
		}
	}

	topWires(amount: number, width: number, height: number, scale) {
		for (let i = 0; i < amount; i++) {
			const miniWire = new WireGraphics();
			miniWire.lineStyle(1 / scale, this.themingService.getEditorColor('wire'));
			miniWire.position.x = (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i;
			miniWire.position.y = 0;
			miniWire.moveTo(0, 0);
			miniWire.lineTo(0, -environment.gridPixelWidth / 2);
			this.addChild(miniWire);
			this._miniWires.push(miniWire);
		}
	}

	bottomWires(amount: number, width: number, height: number, scale) {
		for (let i = 0; i < amount; i++) {
			const miniWire = new WireGraphics();
			miniWire.lineStyle(1 / scale, this.themingService.getEditorColor('wire'));
			miniWire.position.x = (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i;
			miniWire.position.y = height;
			miniWire.moveTo(0, 0);
			miniWire.lineTo(0, environment.gridPixelWidth / 2);
			this.addChild(miniWire);
			this._miniWires.push(miniWire);
		}
	}

	public updateComponent(
		symbol: string,
		inputs: number,
		outputs: number,
		rotation: number,
		scale: number
	) {
		for (const w of this._miniWires) {
			w.destroy();
		}
		this._miniWires = [];
		this.removeChildren(0);
		this.drawComponent(symbol, inputs, outputs, rotation, scale);
	}

	updateScale(scale: number) {
		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			data.lineStyle.width = 1 / scale;
		}
		for (const w of this._miniWires) {
			w.updateScale(scale);
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
