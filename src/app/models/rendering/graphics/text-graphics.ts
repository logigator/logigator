import * as PIXI from 'pixi.js';
import {ComponentUpdatable, LGraphics} from './l-graphics';
import {Element} from '../../element';
import {environment} from '../../../../environments/environment';
import {getStaticDI} from '../../get-di';
import {ThemingService} from '../../../services/theming/theming.service';
import {TextData} from '../../element-types/basic/text';

export class TextGraphics extends PIXI.Container implements LGraphics, ComponentUpdatable {

	readonly element: Element;

	private themingService = getStaticDI(ThemingService);

	private _texts: PIXI.BitmapText[] = [];
	private _point: PIXI.Graphics;

	constructor(scale: number, element: Element) {
		super();
		this.element = element;
		this._point = new PIXI.Graphics();
		this.drawPoint(scale);
		this.addChild(this._point);
		this.renderText(this.element.data as string);
	}

	private renderText(text: string) {
		for (const t of this._texts) {
			t.destroy();
		}
		this._texts = [];
		const textParts = text.split('\n');
		for (let i = 0; i < textParts.length; i++) {
			this._texts[i] = new PIXI.BitmapText(textParts[i], {
				font: {
					name: 'Roboto',
					size: environment.gridPixelWidth + 6
				},
				tint: this.themingService.getEditorColor('fontTint')
			});
			this._texts[i].anchor = new PIXI.Point(0, 0.5);
			this._texts[i].x = environment.gridPixelWidth;
			this._texts[i].y = environment.gridPixelWidth / 2 + environment.gridPixelWidth * i;
			this.addChild(this._texts[i]);
		}
	}

	updateComponent(scale: number, element: Element) {
		this.element.data = element.data;
		this.renderText(this.element.data as TextData);
	}

	drawPoint(scale: number) {
		this._point.clear();
		this._point.beginFill(this.themingService.getEditorColor('wire'));
		const size = scale < 0.5 ? 5 : 7;
		this._point.position = new PIXI.Point(
			environment.gridPixelWidth / 2 - size / 2 / scale,
			environment.gridPixelWidth / 2 - size / 2 / scale
		);
		this._point.drawRect(0, 0, size / scale, size / scale);
	}

	applySimState(scale: number) {
	}

	setSelected(selected: boolean) {
		let tint;
		if (selected) {
			tint = this.themingService.getEditorColor('selectTint');
		} else {
			tint = this.themingService.getEditorColor('fontTint');
		}
		for (const t of this._texts) {
			t.tint = tint;
		}
	}

	setSimulationState(state: boolean[]) {
	}

	updateScale(scale: number) {
		this.drawPoint(scale);
	}

	destroy() {
		super.destroy();
		for (const text of this._texts) {
			text.destroy();
		}
	}

}
