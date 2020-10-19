import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {Element} from '../../element';
import {ElementType, isElementType} from '../../element-types/element-type';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';
import {ElementProviderService} from '../../../services/element-provider/element-provider.service';
import {environment} from '../../../../environments/environment';
import {ElementTypeId} from '../../element-types/element-type-ids';
import {FontWidthService} from '../../../services/font-width/font-width.service';

export class InputOutputGraphics extends PIXI.Graphics implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);
	private elemProvService = getStaticDI(ElementProviderService);

	private _symbol: string;

	private simActiveState: boolean;
	private shouldHaveActiveState: boolean;

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
				typeId: elementOrType.id
			} as any as Element;
			this._symbol = elementOrType.symbol;
		} else {
			this.element = elementOrType;
			this._symbol = this.element.data as string || this.elemProvService.getElementById(this.element.typeId).symbol;
		}
		this.drawComponent();
	}

	private drawComponent() {
		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);

		this.drawRect(0, 0, environment.gridPixelWidth, environment.gridPixelWidth);
		this.beginFill(this.themingService.getEditorColor('wire'));

		let rotForRender = this.element.rotation;
		if (this.element.typeId === ElementTypeId.OUTPUT) {
			rotForRender = this.element.rotation - 2;
		}

		// rotation for input
		switch (rotForRender) {
			case 0:
				this.moveTo(environment.gridPixelWidth, environment.gridPixelWidth / 2);
				this.lineTo(environment.gridPixelWidth / 2 + environment.gridPixelWidth, environment.gridPixelWidth / 2);
				break;
			case 1:
				this.moveTo(environment.gridPixelWidth / 2, environment.gridPixelWidth);
				this.lineTo(environment.gridPixelWidth / 2, environment.gridPixelWidth + environment.gridPixelWidth / 2);
				break;
			case 2:
			case -2:
				this.moveTo(0, environment.gridPixelWidth / 2);
				this.lineTo(-environment.gridPixelWidth / 2, environment.gridPixelWidth / 2);
				break;
			case 3:
			case -1:
				this.moveTo(environment.gridPixelWidth / 2, 0);
				this.lineTo(environment.gridPixelWidth / 2, -environment.gridPixelWidth / 2);
				break;
		}

		this.removeChildren(0);

		const text = new PIXI.BitmapText(this._symbol, {
			fontName: 'Roboto',
			fontSize: this.calcFontSize(),
			tint: this.themingService.getEditorColor('fontTint')
		});

		text.anchor = 0.5;
		text.position.x = environment.gridPixelWidth / 2;
		text.position.y = environment.gridPixelWidth / 2;

		this.addChild(text);
	}

	private calcFontSize(): number {
		const textWidth = getStaticDI(FontWidthService).getTextWidth(this._symbol, '10px Roboto');
		const adjustedSize = 10 * (environment.gridPixelWidth * 0.9 / textWidth);
		return adjustedSize < environment.gridPixelWidth * 0.8 ? adjustedSize : environment.gridPixelWidth * 0.8;
	}

	applySimState(scale: number) {
		// tslint:disable-next-line:triple-equals
		if (this.simActiveState == this.shouldHaveActiveState) return;
		this.simActiveState = this.shouldHaveActiveState;
		// @ts-ignore
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
		this._scale = scale;
		this.geometry.invalidate();
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

	updateComponent(scale: number, newElement: Element) {
		this._scale = scale;
		this._symbol = this.element.data as string || this.elemProvService.getElementById(this.element.typeId).symbol;
		this.clear();
		this.drawComponent();
	}

	updateScale(scale: number) {
		if (this._scale === scale) return;
		this._scale = scale;

		// @ts-ignore
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

}
