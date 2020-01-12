import {environment} from '../../../../environments/environment';
import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';
import {Element} from '../../element';
import {ElementType, isElementType} from '../../element-types/element-type';
import {Elements} from '../../elements';
import {ElementProviderService} from '../../../services/element-provider/element-provider.service';

export class SegmentDisplayGraphics extends PIXI.Graphics implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);
	private elemProvService = getStaticDI(ElementProviderService);

	private _size: PIXI.Point;

	private _labels: string[];

	private simActiveState = [];
	private shouldHaveActiveState = [];

	private segments: Segment[];

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
				typeId: elementOrType.id
			} as any as Element;
			this._labels = elementOrType.calcLabels();
		} else {
			this.element = elementOrType;
			const elemType = this.elemProvService.getElementById(this.element.typeId);
			this._labels = elemType.calcLabels(this.element);
		}
		this._size = Elements.calcPixelElementSize(this.element);
		this.segments = new Array(Math.ceil(Math.log10((2 ** this.element.numInputs) + 1)))
			.fill(undefined)
			.map(() => new Segment(scale, this.themingService));
		this.drawComponent();
	}

	private drawComponent() {
		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.moveTo(0, 0);

		this.beginFill(this.themingService.getEditorColor('wire'));
		this.removeChildren(0);

		switch (this.element.rotation) {
			case 0:
				this.rotation0(this.element.numInputs);
				break;
			case 1:
				this.rotation1(this.element.numInputs, this._size.y, this._size.x);
				break;
			case 2:
				this.rotation2(this.element.numInputs, this._size.y, this._size.x);
				break;
			case 3:
				this.rotation3(this.element.numInputs, this._size.y, this._size.x);
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
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0, 0.5);
			label.x = 1;
			label.y = (environment.gridPixelWidth / 2) + environment.gridPixelWidth * i;
			this.addChild(label);
		}

		// tslint:disable-next-line:max-line-length
		const posXOffset = environment.gridPixelWidth / 1.2 + (this._size.x - environment.gridPixelWidth - this.segments.length * environment.gridPixelWidth * 1.4) / 2;
		const posY = this._size.y / 2 - environment.gridPixelWidth * 1.2;
		for (let i = 0; i < this.segments.length; i++) {
			this.segments[i].position.x = posXOffset + environment.gridPixelWidth * i * 1.4;
			this.segments[i].position.y = posY;
			this.addChild(this.segments[i]);
		}
	}

	private rotation1(inputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, 0);
			this.lineTo(width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i, -(environment.gridPixelWidth / 2));
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0.5, 0);
			label.x = width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i;
			label.y = 1;
			this.addChild(label);
		}

		const posXOffset = (this._size.x - this.segments.length * environment.gridPixelWidth * 1.2) / 2;
		const posY = this._size.y / 2 - environment.gridPixelWidth * 1.2;
		for (let i = 0; i < this.segments.length; i++) {
			this.segments[i].position.x = posXOffset + environment.gridPixelWidth * i * 1.4;
			this.segments[i].position.y = posY;
			this.addChild(this.segments[i]);
		}
	}

	private rotation2(inputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(width, height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
			this.lineTo(width + (environment.gridPixelWidth / 2), height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i);
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(1, 0.5);
			label.x = width - 1;
			label.y = height - (environment.gridPixelWidth / 2) - environment.gridPixelWidth * i;
			this.addChild(label);
		}

		// tslint:disable-next-line:max-line-length
		const posXOffset = (this._size.x - this.segments.length * environment.gridPixelWidth * 1.4) / 2;
		const posY = this._size.y / 2 - environment.gridPixelWidth * 1.2;
		for (let i = 0; i < this.segments.length; i++) {
			this.segments[i].position.x = posXOffset + environment.gridPixelWidth * i * 1.4;
			this.segments[i].position.y = posY;
			this.addChild(this.segments[i]);
		}
	}

	private rotation3(inputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height);
			this.lineTo((environment.gridPixelWidth / 2) + environment.gridPixelWidth * i, height + (environment.gridPixelWidth / 2));
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0.5, 1);
			label.x = width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i;
			label.y = height - 1;
			this.addChild(label);
		}

		const posXOffset = (this._size.x - this.segments.length * environment.gridPixelWidth * 1.2) / 2;
		const posY = this._size.y / 2 - environment.gridPixelWidth * 1.2;
		for (let i = 0; i < this.segments.length; i++) {
			this.segments[i].position.x = posXOffset + environment.gridPixelWidth * i * 1.4;
			this.segments[i].position.y = posY;
			this.addChild(this.segments[i]);
		}
	}

	private getLabelText(text: string): PIXI.BitmapText {
		return new PIXI.BitmapText(text, {
			font: {
				name: 'Roboto',
				size: environment.gridPixelWidth * 0.5
			},
			tint: this.themingService.getEditorColor('fontTint')
		});
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

	public updateComponent(scale: number, element: Element) {
		this.element.numInputs = element.numInputs;
		this.element.numOutputs = element.numOutputs;
		this.element.rotation = element.rotation;
		this._scale = scale;
		const elemType = this.elemProvService.getElementById(this.element.typeId);
		this._labels = elemType.calcLabels(this.element);
		this.clear();
		this._size = Elements.calcPixelElementSize(this.element);
		this.drawComponent();
	}

}


class Segment extends PIXI.Graphics {

	private _themingService: ThemingService;

	constructor(scale: number, themingService: ThemingService) {
		super();
		this._themingService = themingService;
		this.interactiveChildren = false;
		this.sortableChildren = false;
		this.setNumber(undefined, scale);
	}

	public setScale(scale: number) {

	}

	public setNumber(num: number, scale: number) {
		this.moveTo(0, 0);
		this.lineStyle(1 / scale, this._themingService.getEditorColor('wire'));
		this.drawRect(0, 0, environment.gridPixelWidth * 1.2, environment.gridPixelWidth * 2.4);

		// switch (num) {
		// 	default:
		// 		break;
		// }
	}
}
