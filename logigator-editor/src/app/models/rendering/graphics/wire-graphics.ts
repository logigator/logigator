import { LGraphics } from './l-graphics';
import * as PIXI from 'pixi.js';
import { getStaticDI } from '../../get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { Element } from '../../element';
import { Grid } from '../grid';

export class WireGraphics extends PIXI.Graphics implements LGraphics {
	readonly element: Element;

	private _scale: number;
	private themingService = getStaticDI(ThemingService);

	private simActiveState = false;
	private shouldHaveActiveState = false;

	constructor(scale: number, element: Element) {
		super();
		this.element = element;
		this._scale = scale;
		this.lineStyle(1 / scale, 0xffffff);
		this.tint = this.themingService.getEditorColor('wire');
		this.moveTo(0, 0);
		const endPos = Grid.getPixelPosForGridPosWire(this.element.endPos);
		const startPos = Grid.getPixelPosForGridPosWire(this.element.pos);
		this.lineTo(endPos.x - startPos.x, endPos.y - startPos.y);
	}

	public updateScale(scale: number) {
		if (this._scale === scale) return;
		this._scale = scale;

		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			if (this.simActiveState) {
				data.lineStyle.width = 3 / scale;
			} else {
				data.lineStyle.width = 1 / scale;
			}
		}
		this.geometry.invalidate();
	}

	public setSimulationState(state: boolean[]) {
		this.shouldHaveActiveState = state[0];
		if (this.worldVisible) {
			this.applySimState(this._scale);
		}
	}

	public applySimState(scale: number) {
		// tslint:disable-next-line:triple-equals
		if (this.simActiveState == this.shouldHaveActiveState) return;
		this.simActiveState = this.shouldHaveActiveState;
		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			if (this.simActiveState) {
				data.lineStyle.width = 3 / scale;
			} else {
				data.lineStyle.width = 1 / scale;
			}
		}
		this._scale = scale;
		this.geometry.invalidate();
	}

	setSelected(selected: boolean) {
		if (selected) {
			this.tint = this.themingService.getEditorColor('wireSelectColor');
		} else {
			this.tint = this.themingService.getEditorColor('wire');
		}
	}
}
