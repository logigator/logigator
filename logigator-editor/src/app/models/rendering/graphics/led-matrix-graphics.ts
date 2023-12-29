import * as PIXI from 'pixi.js';
import { ComponentUpdatable, LGraphics } from './l-graphics';
import { Element } from '../../element';
import { getStaticDI } from '../../get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { ElementType, isElementType } from '../../element-types/element-type';
import { Elements } from '../../elements';
import { environment } from '../../../../environments/environment';
import { ElementProviderService } from '../../../services/element-provider/element-provider.service';

export class LedMatrixGraphics
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

	private _leds: PIXI.Container;

	constructor(scale: number, element?: Element);
	constructor(scale: number, elementType: ElementType);
	constructor(scale: number, elementOrType: Element | ElementType) {
		super();
		this.interactiveChildren = false;
		this.sortableChildren = false;
		this._scale = scale;
		if (isElementType(elementOrType)) {
			this.element = {
				options: elementOrType.options,
				typeId: elementOrType.id,
				rotation: elementOrType.rotation,
				numInputs: elementOrType.numInputs,
				numOutputs: elementOrType.numOutputs
			} as any as Element;
			this._labels = elementOrType.calcLabels();
		} else {
			this.element = elementOrType;
			const elemType = this.elemProvService.getElementById(this.element.typeId);
			this._labels = elemType.calcLabels(this.element);
		}
		this._size = Elements.calcPixelElementSize(this.element);
		this._leds = this.getLeds();
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

		this.addChild(this._leds);
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

	applySimState(scale: number) {
		if (
			this.shouldHaveActiveState.every((v, i) => v === this.simActiveState[i])
		)
			return;
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
			} else {
				data.lineStyle.width = 1 / scale;
			}
		}
		this.geometry.invalidate();

		for (const led of this._leds.children) {
			(led as PIXI.Graphics).tint = this.simActiveState[wireIndex]
				? this.themingService.getEditorColor('ledOn')
				: this.themingService.getEditorColor('ledOff');
			wireIndex++;
		}
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
		const elemType = this.elemProvService.getElementById(this.element.typeId);
		this._labels = elemType.calcLabels(this.element);
		this.clear();
		this._size = Elements.calcPixelElementSize(this.element);
		this._leds.destroy({ children: true });
		this._leds = this.getLeds();
		this.drawComponent();
	}

	updateScale(scale: number) {
		if (this._scale === scale) return;
		this._scale = scale;

		this.positionLeds(this._leds);

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

	private getLabelText(text: string): PIXI.BitmapText {
		return new PIXI.BitmapText(text, {
			fontName: 'Roboto',
			fontSize: environment.gridPixelWidth * 0.5,
			tint: this.themingService.getEditorColor('fontTint')
		});
	}

	private getLeds(): PIXI.Container {
		let pos: PIXI.Point;
		switch (this.element.rotation) {
			case 0:
				pos = new PIXI.Point(
					1.5 * environment.gridPixelWidth,
					environment.gridPixelWidth
				);
				break;
			case 1:
				pos = new PIXI.Point(
					environment.gridPixelWidth,
					1.5 * environment.gridPixelWidth
				);
				break;
			case 2:
				pos = new PIXI.Point(
					0.5 * environment.gridPixelWidth,
					environment.gridPixelWidth
				);
				break;
			case 3:
				pos = new PIXI.Point(
					environment.gridPixelWidth,
					0.5 * environment.gridPixelWidth
				);
				break;
		}
		const container = new PIXI.Container();
		container.position = pos;

		const ledAmount = this.element.options[0];

		for (let x = 0; x < ledAmount; x++) {
			for (let y = 0; y < ledAmount; y++) {
				const led = new PIXI.Graphics();
				led.beginFill(0xffffff);
				led.drawRect(0, 0, 1, 1);
				led.tint = this.themingService.getEditorColor('ledOff');
				container.addChild(led);
			}
		}
		this.positionLeds(container);
		return container;
	}

	private positionLeds(ledsContainer: PIXI.Container) {
		const ledAmount = this.element.options[0];
		const ledSize =
			(this._size.x - environment.gridPixelWidth * 2) / ledAmount -
			1 / this._scale;

		for (let x = 0; x < ledAmount; x++) {
			for (let y = 0; y < ledAmount; y++) {
				const led = ledsContainer.children[ledAmount * y + x];
				led.scale = new PIXI.Point(ledSize, ledSize);
				led.position.x = x * ledSize + x / this._scale;
				led.position.y = y * ledSize + y / this._scale;
			}
		}
	}
}
