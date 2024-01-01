// @ts-strict-ignore
import * as PIXI from 'pixi.js';
import { ComponentUpdatable, LGraphics } from './l-graphics';
import { Element } from '../../element';
import { ElementType, isElementType } from '../../element-types/element-type';
import { getStaticDI } from '../../get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { environment } from '../../../../environments/environment';

export class LedGraphics
	extends PIXI.Graphics
	implements LGraphics, ComponentUpdatable
{
	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);

	private simActiveState = false;
	private shouldHaveActiveState = false;

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
				numOutputs: elementOrType.numOutputs
			} as Element;
		} else {
			this.element = elementOrType;
		}
		this.drawComponent(this.simActiveState);
	}

	private drawComponent(state: boolean) {
		if (state) {
			this.beginFill(this.themingService.getEditorColor('ledOn'));
		} else {
			this.beginFill(this.themingService.getEditorColor('ledOff'));
		}

		this.moveTo(0, 0);
		this.drawCircle(
			environment.gridPixelWidth / 2,
			environment.gridPixelWidth / 2,
			environment.gridPixelWidth / 2
		);

		if (state) {
			this.lineStyle(
				3 / this._scale,
				this.themingService.getEditorColor('wire')
			);
		} else {
			this.lineStyle(
				1 / this._scale,
				this.themingService.getEditorColor('wire')
			);
		}
		this.beginFill(this.themingService.getEditorColor('wire'));
		switch (this.element.rotation) {
			case 0:
				this.moveTo(0, environment.gridPixelWidth / 2);
				this.lineTo(
					-environment.gridPixelWidth / 2,
					environment.gridPixelWidth / 2
				);
				break;
			case 1:
				this.moveTo(environment.gridPixelWidth / 2, 0);
				this.lineTo(
					environment.gridPixelWidth / 2,
					-environment.gridPixelWidth / 2
				);
				break;
			case 2:
				this.moveTo(environment.gridPixelWidth, environment.gridPixelWidth / 2);
				this.lineTo(
					environment.gridPixelWidth + environment.gridPixelWidth / 2,
					environment.gridPixelWidth / 2
				);
				break;
			case 3:
				this.moveTo(environment.gridPixelWidth / 2, environment.gridPixelWidth);
				this.lineTo(
					environment.gridPixelWidth / 2,
					environment.gridPixelWidth + environment.gridPixelWidth / 2
				);
				break;
		}
	}

	applySimState(scale: number) {
		// tslint:disable-next-line:triple-equals
		if (this.simActiveState == this.shouldHaveActiveState) return;
		this.simActiveState = this.shouldHaveActiveState;
		this.clear();
		this.drawComponent(this.simActiveState);
		this._scale = scale;
	}

	setSelected(selected: boolean) {
		if (selected) {
			this.tint = this.themingService.getEditorColor('selectTint');
		} else {
			this.tint = 0xffffff;
		}
	}

	setSimulationState(state: boolean[]) {
		this.shouldHaveActiveState = state[0];
		if (this.worldVisible) {
			this.applySimState(this._scale);
		}
	}

	updateScale(scale: number) {
		if (this._scale === scale) return;
		this._scale = scale;

		// @ts-expect-error workaround for something that I don't understand anymore
		for (const data of this.geometry.graphicsData) {
			if (data.shape instanceof PIXI.Polygon) {
				if (this.simActiveState) {
					data.lineStyle.width = 3 / scale;
				} else {
					data.lineStyle.width = 1 / scale;
				}
			} else {
				data.lineStyle.width = 1 / scale;
			}
		}
		this.geometry.invalidate();
	}

	updateComponent(scale: number, newElement: Element) {
		this.element.rotation = newElement.rotation;
		this._scale = scale;
		this.clear();
		this.drawComponent(this.simActiveState);
	}
}
