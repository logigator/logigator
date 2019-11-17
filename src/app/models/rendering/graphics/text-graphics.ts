import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {Element} from '../../element';
import {environment} from '../../../../environments/environment';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';

export class TextGraphics extends PIXI.Container implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private themingService = getStaticDI(ThemingService);

	private _texts: PIXI.BitmapText[] = [];

	private _selectionRect: PIXI.Graphics;

	constructor(scale: number, element: Element) {
		super();
		this.element = element;
		this._selectionRect = new PIXI.Graphics();
		this._selectionRect.beginFill(0, 0.3);
		this._selectionRect.drawRect(0, 0,  1, 1);
		this._selectionRect.visible = false;
		this.renderTexts();
		this.addChild(this._selectionRect);
	}

	private renderTexts() {
		for (const text of this._texts) {
			text.destroy();
		}
		this._texts = [];
		const textParts = this.element.text.split('\n');
		for (let i = 0; i < textParts.length; i++) {
			this._texts[i] = new PIXI.BitmapText(textParts[i], {
				font: {
					name: 'Nunito',
					size: environment.gridPixelWidth + 4
				},
				tint: this.themingService.getEditorColor('fontTint')
			});
			this._texts[i].x = 0;
			this._texts[i].y = environment.gridPixelWidth * i;
			this.addChild(this._texts[i]);
		}

		this._selectionRect.width = 0;
		this._selectionRect.width = Math.ceil(this.width / environment.gridPixelWidth) * environment.gridPixelWidth;
		this._selectionRect.height = this._texts.length * environment.gridPixelWidth;
		this.hitArea = new PIXI.Rectangle(
			0,
			0,
			this._selectionRect.width,
			this._selectionRect.height
		);
		this.element.endPos = new PIXI.Point(
			this.element.pos.x + Math.ceil(this.width / environment.gridPixelWidth),
			this.element.pos.y + this._texts.length
		);
	}

	updateComponent(scale: number, inputs: number, outputs: number, rotation: number) {
		this.renderTexts();
	}

	applySimState(scale: number) {
	}

	setSelected(selected: boolean) {
		this._selectionRect.visible = selected;
	}

	setSimulationState(state: boolean[]) {
	}

	updateScale(scale: number) {
	}

	destroy() {
		super.destroy();
		for (const text of this._texts) {
			text.destroy();
		}
	}

}
