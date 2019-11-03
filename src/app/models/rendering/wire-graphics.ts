import {LGraphics} from './l-graphics';
import * as PIXI from 'pixi.js';

export class WireGraphics extends LGraphics {

	private simActiveState = false;
	private shouldHaveActiveState = false;

	constructor(scale: number, endPos: PIXI.Point, startPos: PIXI.Point) {
		super(scale);
		this.lineStyle(1 / scale, this.themingService.getEditorColor('wire'));
		this.moveTo(0, 0);
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

	public setWireState(state: boolean) {
		this.shouldHaveActiveState = state;
		if (this.worldVisible) {
			this.applySimState(this._scale);
		}
	}

	public applySimState(scale: number) {
		if (this.simActiveState === this.shouldHaveActiveState) return;
		this.simActiveState = this.shouldHaveActiveState;
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
}
