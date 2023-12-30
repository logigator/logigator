import * as PIXI from 'pixi.js';
import { ComponentUpdatable, LGraphics } from './l-graphics';
import { Element } from '../../element';
import { ElementType, isElementType } from '../../element-types/element-type';
import { getStaticDI } from '../../get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { ElementProviderService } from '../../../services/element-provider/element-provider.service';
import { environment } from '../../../../environments/environment';
import { ElementTypeId } from '../../element-types/element-type-ids';
import { FontWidthService } from '../../../services/font-width/font-width.service';
import { Project } from '../../project';

export class InputOutputGraphics
	extends PIXI.Graphics
	implements LGraphics, ComponentUpdatable
{
	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);
	private elemProvService = getStaticDI(ElementProviderService);

	private _symbol: string;

	private simActiveState: boolean;
	private shouldHaveActiveState: boolean;

	private project: Project;

	constructor(scale: number, element: Element, project: Project);
	constructor(scale: number, elementType: ElementType);
	constructor(
		scale: number,
		elementOrType: Element | ElementType,
		project?: Project
	) {
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
		} else {
			this.element = elementOrType;
			this._symbol =
				(this.element.data as string) ||
				this.elemProvService.getElementById(this.element.typeId).symbol;
			this.project = project;
		}

		this.drawComponent();
	}

	private drawComponent() {
		this.lineStyle(1 / this._scale, this.themingService.getEditorColor('wire'));
		this.beginFill(this.themingService.getEditorColor('wire'));

		let rotForRender = this.element.rotation;
		if (this.element.typeId === ElementTypeId.OUTPUT)
			rotForRender = (this.element.rotation + 2) % 4;

		// rotation for input
		switch (rotForRender) {
			case 0:
				this.moveTo(environment.gridPixelWidth, environment.gridPixelWidth / 2);
				this.lineTo(
					environment.gridPixelWidth / 2 + environment.gridPixelWidth,
					environment.gridPixelWidth / 2
				);
				break;
			case 1:
				this.moveTo(environment.gridPixelWidth / 2, environment.gridPixelWidth);
				this.lineTo(
					environment.gridPixelWidth / 2,
					environment.gridPixelWidth + environment.gridPixelWidth / 2
				);
				break;
			case 2:
				this.moveTo(0, environment.gridPixelWidth / 2);
				this.lineTo(
					-environment.gridPixelWidth / 2,
					environment.gridPixelWidth / 2
				);
				break;
			case 3:
				this.moveTo(environment.gridPixelWidth / 2, 0);
				this.lineTo(
					environment.gridPixelWidth / 2,
					-environment.gridPixelWidth / 2
				);
				break;
		}

		this.beginFill(this.themingService.getEditorColor('background'));
		this.moveTo(0, 0);
		this.drawRect(0, 0, environment.gridPixelWidth, environment.gridPixelWidth);

		this.removeChildren(0);

		const symbol = new PIXI.BitmapText(this._symbol, {
			fontName: 'Roboto',
			fontSize: this.calcFontSize(),
			tint: this.themingService.getEditorColor('fontTint')
		});
		symbol.anchor = 0.5;
		symbol.position.x = environment.gridPixelWidth / 2;
		symbol.position.y = environment.gridPixelWidth / 2 - 2;

		if (this.project) {
			const plugIndex = new PIXI.BitmapText(this.getPlugIndex(), {
				fontName: 'Roboto',
				fontSize: 6,
				tint: this.themingService.getEditorColor('fontTint')
			});
			plugIndex.position.x = environment.gridPixelWidth / 2;
			plugIndex.position.y = environment.gridPixelWidth;
			plugIndex.anchor = new PIXI.Point(0.5, 1);
			this.addChild(plugIndex);
		}

		this.addChild(symbol);
	}

	private getPlugIndex(): string {
		if (this.element.typeId === ElementTypeId.INPUT) {
			return this.element.plugIndex + 1 + '';
		} else {
			return this.element.plugIndex - this.project.numInputs + 1 + '';
		}
	}

	private calcFontSize(): number {
		const textWidth = getStaticDI(FontWidthService).getTextWidth(
			this._symbol,
			'10px Roboto'
		);
		const adjustedSize = 10 * ((environment.gridPixelWidth * 0.9) / textWidth);
		return adjustedSize < environment.gridPixelWidth * 0.8
			? adjustedSize
			: environment.gridPixelWidth * 0.8;
	}

	applySimState(scale: number) {
		// tslint:disable-next-line:triple-equals
		if (this.simActiveState == this.shouldHaveActiveState) return;
		this.simActiveState = this.shouldHaveActiveState;
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

	updateComponent(scale: number) {
		this._scale = scale;
		this._symbol =
			(this.element.data as string) ||
			this.elemProvService.getElementById(this.element.typeId).symbol;
		this.clear();
		this.drawComponent();
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
}
