import { environment } from '../../../../environments/environment';
import * as PIXI from 'pixi.js';
import { ComponentUpdatable, LGraphics } from './l-graphics';
import { getStaticDI } from '../../get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { Element } from '../../element';
import { ElementProviderService } from '../../../services/element-provider/element-provider.service';
import { ElementType, isElementType } from '../../element-types/element-type';
import { Elements } from '../../elements';
import { FontWidthService } from '../../../services/font-width/font-width.service';

export class ComponentGraphics
	extends PIXI.Graphics
	implements LGraphics, ComponentUpdatable
{
	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);
	private elemProvService = getStaticDI(ElementProviderService);

	private _symbol: string;

	private _size: PIXI.Point;

	private _labels: string[];

	protected simActiveState = [];
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
				typeId: elementOrType.id
			} as Element;
			this._symbol = elementOrType.symbol;
			if (elementOrType.calcLabels) this._labels = elementOrType.calcLabels();
		} else {
			this.element = elementOrType;
			const elemType = this.elemProvService.getElementById(this.element.typeId);
			this._symbol = elemType.symbol;
			if (elemType.calcLabels) this._labels = elemType.calcLabels(this.element);
		}
		this._size = Elements.calcPixelElementSize(this.element);

		this.drawComponent();
	}

	private drawComponent() {
		this.removeChildren(0);

		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.moveTo(0, 0);

		this.beginFill(this.themingService.getEditorColor('wire'));

		switch (this.element.rotation) {
			case 0:
				this.rotation0(
					this.element.numInputs,
					this.element.numOutputs,
					this._size.y,
					this._size.x
				);
				break;
			case 1:
				this.rotation1(
					this.element.numInputs,
					this.element.numOutputs,
					this._size.y,
					this._size.x
				);
				break;
			case 2:
				this.rotation2(
					this.element.numInputs,
					this.element.numOutputs,
					this._size.y,
					this._size.x
				);
				break;
			case 3:
				this.rotation3(
					this.element.numInputs,
					this.element.numOutputs,
					this._size.y,
					this._size.x
				);
				break;
		}

		const text = new PIXI.BitmapText(this._symbol, {
			fontName: 'Roboto',
			fontSize: this.calcFontSize(),
			tint: this.themingService.getEditorColor('fontTint')
		});
		text.anchor = 0.5;
		text.position.x = this._size.x / 2;
		text.position.y = this._size.y / 2;

		this.addChild(text);
	}

	private calcFontSize(): number {
		const textWidth = getStaticDI(FontWidthService).getTextWidth(
			this._symbol,
			'10px Roboto'
		);
		const adjustedSize = 10 * ((environment.gridPixelWidth * 1.4) / textWidth);
		return adjustedSize < environment.gridPixelWidth * 0.9
			? adjustedSize
			: environment.gridPixelWidth * 0.9;
	}

	private rotation0(
		inputs: number,
		outputs: number,
		height: number,
		width: number
	) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				-(environment.gridPixelWidth / 2),
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i
			);
			this.lineTo(
				0,
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i
			);
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0, 0.5);
			label.x = 1;
			label.y = environment.gridPixelWidth / 2 + environment.gridPixelWidth * i;
			this.addChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				width,
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i
			);
			this.lineTo(
				width + environment.gridPixelWidth / 2,
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i
			);
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(this._labels[inputs + i]);
			label.anchor = new PIXI.Point(1, 0.5);
			label.x = width - 1;
			label.y = environment.gridPixelWidth / 2 + environment.gridPixelWidth * i;
			this.addChild(label);
		}

		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);
		this.lineTo(width - 3, 0);
		this.lineTo(width, 3);
		this.lineTo(width, height - 3);
		this.lineTo(width - 3, height);
		this.lineTo(0, height);
		this.lineTo(0, 0);
	}

	private rotation1(
		inputs: number,
		outputs: number,
		height: number,
		width: number
	) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i,
				0
			);
			this.lineTo(
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i,
				-(environment.gridPixelWidth / 2)
			);
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0.5, 0);
			label.x =
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i;
			label.y = 1;
			this.addChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i,
				height
			);
			this.lineTo(
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i,
				height + environment.gridPixelWidth / 2
			);
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(this._labels[inputs + i]);
			label.anchor = new PIXI.Point(0.5, 1);
			label.x =
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i;
			label.y = height - 1;
			this.addChild(label);
		}

		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);
		this.lineTo(width, 0);
		this.lineTo(width, height - 3);
		this.lineTo(width - 3, height);
		this.lineTo(3, height);
		this.lineTo(0, height - 3);
		this.lineTo(0, 0);
	}

	private rotation2(
		inputs: number,
		outputs: number,
		height: number,
		width: number
	) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				width,
				height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i
			);
			this.lineTo(
				width + environment.gridPixelWidth / 2,
				height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i
			);
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(1, 0.5);
			label.x = width - 1;
			label.y =
				height -
				environment.gridPixelWidth / 2 -
				environment.gridPixelWidth * i;
			this.addChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				0,
				height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i
			);
			this.lineTo(
				-environment.gridPixelWidth / 2,
				height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i
			);
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(this._labels[inputs + i]);
			label.anchor = new PIXI.Point(0, 0.5);
			label.x = 1;
			label.y =
				height -
				environment.gridPixelWidth / 2 -
				environment.gridPixelWidth * i;
			this.addChild(label);
		}

		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(3, 0);
		this.lineTo(width, 0);
		this.lineTo(width, height);
		this.lineTo(3, height);
		this.lineTo(0, height - 3);
		this.lineTo(0, 3);
		this.lineTo(3, 0);
	}

	private rotation3(
		inputs: number,
		outputs: number,
		height: number,
		width: number
	) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i,
				height
			);
			this.lineTo(
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i,
				height + environment.gridPixelWidth / 2
			);
			if (!this._labels || !this._labels[i]) continue;
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0.5, 1);
			label.x = environment.gridPixelWidth / 2 + environment.gridPixelWidth * i;
			label.y = height - 1;
			this.addChild(label);
		}
		for (let i = 0; i < outputs; i++) {
			this.moveTo(
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i,
				0
			);
			this.lineTo(
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i,
				-(environment.gridPixelWidth / 2)
			);
			if (!this._labels || !this._labels[inputs + i]) continue;
			const label = this.getLabelText(this._labels[inputs + i]);
			label.anchor = new PIXI.Point(0.5, 0);
			label.x = environment.gridPixelWidth / 2 + environment.gridPixelWidth * i;
			label.y = 1;
			this.addChild(label);
		}

		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(3, 0);
		this.lineTo(width - 3, 0);
		this.lineTo(width, 3);
		this.lineTo(width, height);
		this.lineTo(0, height);
		this.lineTo(0, 3);
		this.lineTo(3, 0);
	}

	private getLabelText(text: string): PIXI.BitmapText {
		return new PIXI.BitmapText(text, {
			fontName: 'Roboto',
			fontSize: environment.gridPixelWidth * 0.5,
			tint: this.themingService.getEditorColor('fontTint')
		});
	}

	public applySimState(scale: number): boolean {
		if (
			this.shouldHaveActiveState.every((v, i) => v === this.simActiveState[i])
		)
			return false;
		this.simActiveState = this.shouldHaveActiveState;

		let wireIndex = 0;
		// @ts-expect-error workaround for something that I don't understand anymore
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
		return true;
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

		// @ts-expect-error workaround for something that I don't understand anymore
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

	public updateComponent(scale: number, element: Element) {
		this.element.numInputs = element.numInputs;
		this.element.numOutputs = element.numOutputs;
		this.element.rotation = element.rotation;
		this._scale = scale;
		const elemType = this.elemProvService.getElementById(this.element.typeId);
		if (elemType.calcLabels) this._labels = elemType.calcLabels(this.element);
		this._symbol = elemType.symbol;
		this.clear();
		this._size = Elements.calcPixelElementSize(this.element);
		this.drawComponent();
	}
}
