import {environment} from '../../../environments/environment';
import * as PIXI from 'pixi.js';
import {LGraphics} from './l-graphics';
import {getStaticDI} from '../get-di';
import {ThemingService} from '../../services/theming/theming.service';
import {Element} from '../element';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';

export class ComponentGraphics extends PIXI.Graphics implements LGraphics {

	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);

	private readonly _symbol: string;

	private simActiveState = [];
	private shouldHaveActiveState = [];

	constructor(scale: number, element?: Element);
	constructor(scale: number, symbol: string, inputs: number, outputs: number, rotation: number);
	constructor(scale: number, elementOrSymbol: Element | string, inputs?: number, outputs?: number, rotation?: number) {
		super();
		this.interactiveChildren = false;
		this.sortableChildren = false;
		if (typeof elementOrSymbol === 'string') {
			this.element = {
				rotation,
				numInputs: inputs,
				numOutputs: outputs,
			} as any as Element;
			this._symbol = elementOrSymbol;
		} else {
			this._scale = scale;
			this.element = elementOrSymbol;
			this._symbol = getStaticDI(ElementProviderService).getElementById(this.element.typeId).symbol;
		}
		this.drawComponent(this._symbol, this.element.numInputs, this.element.numOutputs, this.element.rotation, scale);
	}

	private drawComponent(symbol: string, inputs: number, outputs: number, rotation: number, scale: number) {
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
				this.rotation0(inputs, outputs, height, width);
				break;
			case 1:
				this.rotation1(inputs, outputs, height, width);
				break;
			case 2:
				this.rotation2(inputs, outputs, height, width);
				break;
			case 3:
				this.rotation3(inputs, outputs, height, width);
				break;
		}

		this.removeChildren(0);

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

	private rotation0(inputs: number, outputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(-(environment.gridPixelWidth / 2), (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			this.lineTo(0, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(width, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			this.lineTo(width + environment.gridPixelWidth / 2, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	private rotation1(inputs: number, outputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, 0);
			this.lineTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, -(environment.gridPixelWidth / 2));
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, height);
			this.lineTo(width - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i, height + environment.gridPixelWidth / 2);
		}
	}

	private rotation2(inputs: number, outputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(width, height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
			this.lineTo(width + (environment.gridPixelWidth / 2), height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(0, height - (environment.gridPixelWidth / 2) - (environment.gridPixelWidth * i));
			this.lineTo(-(environment.gridPixelWidth / 2), height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
		}
	}

	private rotation3(inputs: number, outputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height);
			this.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height + (environment.gridPixelWidth / 2));
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(environment.gridPixelWidth / 2 + environment.gridPixelWidth * i, 0);
			this.lineTo(environment.gridPixelWidth / 2 + environment.gridPixelWidth * i, -(environment.gridPixelWidth / 2));
		}
	}

	public applySimState(scale: number) {
		if (this.shouldHaveActiveState.every((v, i) => v === this.simActiveState[i])) return;
		this.simActiveState = this.shouldHaveActiveState;

		let wireIndex = 0;
		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			if (data.shape instanceof PIXI.Polygon) {
				if (this.simActiveState[wireIndex]) {
					data.lineStyle.width = 3 / scale;
				} else {
					data.lineStyle.width = 1 / scale;
				}
				wireIndex++;
			}
		}
		this._scale = scale;
		this.geometry.invalidate();
	}

	public setSimulationSate(state: boolean[]) {
		this.shouldHaveActiveState = state;
		if (this.worldVisible) {
			this.applySimState(this._scale);
		}
	}

	public updateScale(scale: number) {
		if (this._scale === scale) return;
		this._scale = scale;

		let wireIndex = 0;

		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			if (data.shape instanceof PIXI.Polygon) {
				if (this.simActiveState[wireIndex]) {
					data.lineStyle.width = 3 / scale;
				} else {
					data.lineStyle.width = 1 / scale;
				}
				wireIndex++;
			} else {
				data.lineStyle.width = 1 / scale;
			}
		}
		this.geometry.invalidate();
	}

	setSelected(selected: boolean) {
		if (selected) {
			this.tint = this.themingService.getEditorColor('selectTint');
		} else {
			this.tint = 0xffffff;
		}
	}

	public updateComponent(scale: number, inputs: number, outputs: number, rotation: number) {
		this.element.numInputs = inputs;
		this.element.numOutputs = outputs;
		this.element.rotation = rotation;
		this._scale = scale;
		this.clear();
		this.drawComponent(this._symbol, inputs, outputs, rotation, scale);
	}



}
