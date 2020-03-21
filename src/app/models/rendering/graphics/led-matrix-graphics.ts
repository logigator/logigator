import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {Element} from '../../element';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';
import {ElementType, isElementType} from '../../element-types/element-type';
import {Elements} from '../../elements';
import {environment} from '../../../../environments/environment';

export class LedMatrixGraphics extends PIXI.Graphics implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);

	private _size: PIXI.Point;

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
				typeId: elementOrType.id,
				rotation: elementOrType.rotation,
				numInputs: elementOrType.numInputs,
				numOutputs: elementOrType.numOutputs,
			} as any as Element;
		} else {
			this.element = elementOrType;
		}
		this._size = Elements.calcPixelElementSize(this.element);
		this.drawComponent();
	}

	private drawComponent() {
		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.moveTo(0, 0);

		this.beginFill(this.themingService.getEditorColor('wire'));

		switch (this.element.rotation) {
			case 0:
				this.rotation0(this.element.numInputs);
				break;
			case 1:
				this.rotation1(this.element.numInputs, this._size.x);
				break;
			case 2:
				this.rotation2(this.element.numInputs, this._size.y, this._size.x);
				break;
			case 3:
				this.rotation3(this.element.numInputs, this._size.y);
				break;
		}

		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);
		this.drawRect(0, 0, this._size.x, this._size.y);
	}

	private rotation0(inputs: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(-(environment.gridPixelWidth / 2), (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
			this.lineTo(0, (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i);
		}
	}

	private rotation1(inputs: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, 0);
			this.lineTo(width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, -(environment.gridPixelWidth / 2));
		}
	}

	private rotation2(inputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(width, height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
			this.lineTo(width + (environment.gridPixelWidth / 2), height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
		}
	}

	private rotation3(inputs: number, height: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height);
			this.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height + (environment.gridPixelWidth / 2));
		}
	}

	applySimState(scale: number) {
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

	setSimulationState(state: boolean[]) {
		this.shouldHaveActiveState = state;
		if (this.worldVisible) {
			this.applySimState(this._scale);
		}
	}

	setSelected(selected: boolean) {
		if (selected) {
			this.tint = this.themingService.getEditorColor('selectTint');
		} else {
			this.tint = 0xffffff;
		}
	}

	updateComponent(scale: number, element: Element) {
		this.element.numInputs = element.numInputs;
		this.element.rotation = element.rotation;
		this._scale = scale;
		this.clear();
		this._size = Elements.calcPixelElementSize(this.element);
		this.drawComponent();
	}

	updateScale(scale: number) {
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

}
