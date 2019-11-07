import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {Element} from '../../element';
import {ElementType, isElementType} from '../../element-types/element-type';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';
import {environment} from '../../../../environments/environment';
import {WorkerCommunicationService} from '../../../services/simulation/worker-communication/worker-communication.service';
import {RenderTicker} from '../../../services/render-ticker/render-ticker.service';
import {ElementProviderService} from '../../../services/element-provider/element-provider.service';

export class LeverGraphics extends PIXI.Graphics implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private readonly _projectIdentifier: string;

	private readonly workerCommunicationService = getStaticDI(WorkerCommunicationService);

	private _scale: number;
	private themingService = getStaticDI(ThemingService);

	private readonly _width: number;

	private simActiveState = false;
	private shouldHaveActiveState = false;

	constructor(scale: number, element: Element, projectIdentifier: string);
	constructor(scale: number, elementType: ElementType);
	constructor(scale: number, elementOrType: Element | ElementType, projectIdentifier?: string) {
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
			this._width = elementOrType.width;
		} else {
			this.element = elementOrType;
			this._projectIdentifier = projectIdentifier;
			this._width = getStaticDI(ElementProviderService).getElementById(this.element.typeId).width;

		}
		this.drawComponent();
		if (this._projectIdentifier) this.addClickListener();
	}

	private drawComponent() {
		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);
		this.drawRect(0, 0, environment.gridPixelWidth * this._width, environment.gridPixelWidth);
		this.drawRect(3, 3, environment.gridPixelWidth - 6, environment.gridPixelWidth - 6);
		this.beginFill(this.themingService.getEditorColor('wire'));


		switch (this.element.rotation) {
			case 0:
				this.moveTo(environment.gridPixelWidth * this._width, environment.gridPixelWidth / 2);
				this.lineTo(environment.gridPixelWidth * this._width + environment.gridPixelWidth / 2, environment.gridPixelWidth / 2);
				break;
			case 1:
				this.moveTo(environment.gridPixelWidth / 2, environment.gridPixelWidth * this._width);
				this.lineTo(environment.gridPixelWidth / 2, environment.gridPixelWidth * this._width + environment.gridPixelWidth / 2);
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
			const newSate = !this.simActiveState;
			this.workerCommunicationService.setUserInput(this._projectIdentifier, this.element, [newSate]);
			this.setSimulationState([newSate]);
			getStaticDI(RenderTicker).singleFrame(this._projectIdentifier);
		});
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
			} else if (data.shape instanceof PIXI.Rectangle && data.shape.width === 10 && data.shape.height === 10){
				if (this.simActiveState) {
					data.fillStyle.color = this.themingService.getEditorColor('wire');
				} else {
					data.fillStyle.color = this.themingService.getEditorColor('background');
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
