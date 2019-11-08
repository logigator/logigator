import {environment} from '../../../../environments/environment';
import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';
import {Element} from '../../element';
import {ElementProviderService} from '../../../services/element-provider/element-provider.service';
import {ElementType, isElementType} from '../../element-types/element-type';

export class ComponentGraphics extends PIXI.Graphics implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);

	private readonly _symbol: string;
	private readonly _width: number;

	private simActiveState = [];
	private shouldHaveActiveState = [];

	constructor(scale: number, element?: Element);
	constructor(scale: number, elementType: ElementType);
	constructor(scale: number, elementOrType: Element | ElementType) {
		super();
		this.interactiveChildren = false;
		this.sortableChildren = false;
		this._scale = scale;
		if (isElementType(elementOrType)) {
			this.element = {
				rotation: elementOrType.rotation,
				numInputs: elementOrType.numInputs,
				numOutputs: elementOrType.numOutputs,
			} as any as Element;
			this._symbol = elementOrType.symbol;
			this._width = elementOrType.width;
		} else {
			this.element = elementOrType;
			this._symbol = getStaticDI(ElementProviderService).getElementById(this.element.typeId).symbol;
			this._width = getStaticDI(ElementProviderService).getElementById(this.element.typeId).width;
		}
		this.drawComponent();
	}

	private drawComponent() {
		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);

		let width;
		let height;
		if (this.element.rotation === 0 || this.element.rotation === 2) {
			width = environment.gridPixelWidth * this._width;
			height = this.element.numInputs >= this.element.numOutputs ?
				environment.gridPixelWidth * this.element.numInputs :
				environment.gridPixelWidth * this.element.numOutputs;
		} else {
			width = this.element.numInputs >= this.element.numOutputs ?
				environment.gridPixelWidth * this.element.numInputs :
				environment.gridPixelWidth * this.element.numOutputs;
			height = environment.gridPixelWidth * this._width;
		}
		this.drawRect(0, 0, width, height);

		this.beginFill(this.themingService.getEditorColor('wire'));

		switch (this.element.rotation) {
			case 0:
				this.rotation0(this.element.numInputs, this.element.numOutputs, height, width);
				break;
			case 1:
				this.rotation1(this.element.numInputs, this.element.numOutputs, height, width);
				break;
			case 2:
				this.rotation2(this.element.numInputs, this.element.numOutputs, height, width);
				break;
			case 3:
				this.rotation3(this.element.numInputs, this.element.numOutputs, height, width);
				break;
		}

		this.removeChildren(0);

		const text = new PIXI.BitmapText(this._symbol, {
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

	public setSimulationState(state: boolean[]) {
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
		this.drawComponent();
	}

}
