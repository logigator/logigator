// @ts-strict-ignore
import { environment } from '../../../../environments/environment';
import * as PIXI from 'pixi.js';
import { ComponentUpdatable, LGraphics } from './l-graphics';
import { getStaticDI } from '../../get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { Element } from '../../element';
import { ElementType, isElementType } from '../../element-types/element-type';
import { Elements } from '../../elements';
import { ElementProviderService } from '../../../services/element-provider/element-provider.service';

export class SegmentDisplayGraphics
	extends PIXI.Graphics
	implements LGraphics, ComponentUpdatable
{
	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);
	private elemProvService = getStaticDI(ElementProviderService);

	private _size: PIXI.Point;

	private _labels: string[];

	private simActiveState = [];
	private shouldHaveActiveState = [];

	private segmentText: PIXI.Container;
	private segmentTextLength: number;

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
				typeId: elementOrType.id,
				options: elementOrType.options
			} as Element;
			this._labels = elementOrType.calcLabels();
		} else {
			this.element = elementOrType;
			const elemType = this.elemProvService.getElementById(this.element.typeId);
			this._labels = elemType.calcLabels(this.element);
		}
		this._size = Elements.calcPixelElementSize(this.element);
		this.segmentText = this.getSegments();
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

		this.addChild(this.segmentText);
	}

	private rotation0(inputs: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				-(environment.gridPixelWidth / 2),
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i
			);
			this.lineTo(
				0,
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i
			);
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0, 0.5);
			label.x = 1;
			label.y = environment.gridPixelWidth / 2 + environment.gridPixelWidth * i;
			this.addChild(label);
		}
	}

	private rotation1(inputs: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i,
				0
			);
			this.lineTo(
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i,
				-(environment.gridPixelWidth / 2)
			);
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0.5, 0);
			label.x =
				width - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i;
			label.y = 1;
			this.addChild(label);
		}
	}

	private rotation2(inputs: number, height: number, width: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				width,
				height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i
			);
			this.lineTo(
				width + environment.gridPixelWidth / 2,
				height - environment.gridPixelWidth / 2 - environment.gridPixelWidth * i
			);
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(1, 0.5);
			label.x = width - 1;
			label.y =
				height -
				environment.gridPixelWidth / 2 -
				environment.gridPixelWidth * i;
			this.addChild(label);
		}
	}

	private rotation3(inputs: number, height: number) {
		for (let i = 0; i < inputs; i++) {
			this.moveTo(
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i,
				height
			);
			this.lineTo(
				environment.gridPixelWidth / 2 + environment.gridPixelWidth * i,
				height + environment.gridPixelWidth / 2
			);
			const label = this.getLabelText(this._labels[i]);
			label.anchor = new PIXI.Point(0.5, 1);
			label.x = environment.gridPixelWidth / 2 + environment.gridPixelWidth * i;
			label.y = height - 1;
			this.addChild(label);
		}
	}

	private getLabelText(text: string): PIXI.BitmapText {
		return new PIXI.BitmapText(text, {
			fontName: 'Roboto',
			fontSize: environment.gridPixelWidth * 0.5,
			tint: this.themingService.getEditorColor('fontTint')
		});
	}

	private getSegmentTextLength() {
		switch (this.element.options[0]) {
			case 1:
				return Math.ceil(this.element.numInputs / 4);
			case 2:
				return Math.ceil(this.element.numInputs / 3);
			default:
				return Math.ceil(Math.log10(2 ** this.element.numInputs + 1));
		}
	}

	private getSegments(): PIXI.Container {
		const container = new PIXI.Container();
		this.segmentTextLength = this.getSegmentTextLength();
		const seg = new PIXI.BitmapText(
			this.getSegmentString(0, this.segmentTextLength),
			{
				fontName: this.element.options[0] === 1 ? 'DSEG14' : 'DSEG7',
				fontSize: environment.gridPixelWidth * 1.35,
				tint: this.themingService.getEditorColor('fontTint'),
				align: 'center'
			}
		);
		seg.anchor = new PIXI.Point(0.5, 0.5);
		seg.position = new PIXI.Point(this._size.x / 2, this._size.y / 2);

		const base = new PIXI.BitmapText(
			this.element.options[0] === 0
				? '10'
				: this.element.options[0] === 1
					? '16'
					: '8',
			{
				fontName: 'DSEG7',
				fontSize: environment.gridPixelWidth * 0.4,
				tint: this.themingService.getEditorColor('fontTint'),
				align: 'center'
			}
		);
		base.anchor = new PIXI.Point(0, 0.5);
		base.position = new PIXI.Point(
			seg.position.x +
				seg.width / 2 -
				(this.element.options[0] !== 2 ? environment.gridPixelWidth * 0.2 : 0),
			seg.position.y + seg.height / 2
		);
		container.addChild(seg);
		container.addChild(base);
		return container;
	}

	private getSegmentString(num: number, length: number): string {
		let str;
		switch (this.element.options[0]) {
			case 1:
				str = num.toString(16);
				break;
			case 2:
				str = num.toString(8);
				break;
			default:
				str = num.toString();
		}
		while (str.length < length) str = '0' + str;
		return str;
	}

	public applySimState(scale: number) {
		if (
			this.shouldHaveActiveState.every((v, i) => v === this.simActiveState[i])
		)
			return;
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

		let numberToDisplay = 0;
		for (let i = this.simActiveState.length - 1; i >= 0; i--) {
			if (this.simActiveState[i]) {
				numberToDisplay = (numberToDisplay << 1) | 1;
			} else {
				numberToDisplay = numberToDisplay << 1;
			}
		}
		(this.segmentText.children[0] as PIXI.BitmapText).text =
			this.getSegmentString(numberToDisplay, this.segmentTextLength);
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
		this.element.rotation = element.rotation;
		this._scale = scale;
		const elemType = this.elemProvService.getElementById(this.element.typeId);
		this._labels = elemType.calcLabels(this.element);
		this.clear();
		this._size = Elements.calcPixelElementSize(this.element);
		this.segmentText.destroy({ children: true });
		this.segmentText = this.getSegments();
		this.drawComponent();
	}
}
