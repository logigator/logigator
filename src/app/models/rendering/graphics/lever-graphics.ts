import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {Element} from '../../element';
import {ElementType, isElementType} from '../../element-types/element-type';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';
import {environment} from '../../../../environments/environment';
import {WorkerCommunicationService} from '../../../services/simulation/worker-communication/worker-communication.service';

export class LeverGraphics extends PIXI.Graphics implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private readonly _parentProjectIdentifier: string;

	private readonly workerCommunicationService = getStaticDI(WorkerCommunicationService);

	private _scale: number;
	private themingService = getStaticDI(ThemingService);

	private simActiveState = false;
	private shouldHaveActiveState = false;

	constructor(scale: number, element: Element, parentProjectIdentifier: string);
	constructor(scale: number, elementType: ElementType);
	constructor(scale: number, elementOrType: Element | ElementType, parentProjectIdentifier?: string) {
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
		} else {
			this.element = elementOrType;
			this._parentProjectIdentifier = parentProjectIdentifier;
		}
		this.drawComponent();
		if (this._parentProjectIdentifier) this.addClickListener();
	}

	private drawComponent() {
		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);
		this.drawRect(0, 0, environment.gridPixelWidth, environment.gridPixelWidth);
		this.beginFill(this.themingService.getEditorColor('wire'));

		switch (this.element.rotation) {
			case 0:
				this.moveTo(environment.gridPixelWidth, environment.gridPixelWidth / 2);
				this.lineTo(environment.gridPixelWidth + environment.gridPixelWidth / 2, environment.gridPixelWidth / 2);
				break;
			case 1:
				this.moveTo(environment.gridPixelWidth / 2, environment.gridPixelWidth);
				this.lineTo(environment.gridPixelWidth / 2, environment.gridPixelWidth + environment.gridPixelWidth / 2);
				break;
			case 2:
				this.moveTo(0, environment.gridPixelWidth / 2);
				this.lineTo(-environment.gridPixelWidth / 2, environment.gridPixelWidth / 2);
				break;
			case 3:
				this.moveTo(environment.gridPixelWidth / 2, 0);
				this.lineTo(environment.gridPixelWidth / 2, -environment.gridPixelWidth / 2);
				break;
		}
	}

	private addClickListener() {
		this.interactive = true;
		this.on('pointerdown', (e: PIXI.interaction.InteractionEvent) => {
			this.simActiveState = !this.simActiveState;
			this.workerCommunicationService.setUserInput(this._parentProjectIdentifier, this.element, [this.simActiveState]);
			this.setSimulationState([this.simActiveState]);
		});
	}

	applySimState(scale: number) {
		if (this.simActiveState === this.shouldHaveActiveState) return;
		this.simActiveState = this.shouldHaveActiveState;
		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			if (data.shape instanceof PIXI.Polygon) {
				if (this.simActiveState) {
					data.lineStyle.width = 3 / scale;
				} else {
					data.lineStyle.width = 1 / scale;
				}
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

	updateComponent(scale: number, inputs: number, outputs: number, rotation: number) {
		this.element.rotation = rotation;
		this._scale = scale;
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
