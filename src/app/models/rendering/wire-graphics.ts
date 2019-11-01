import * as PIXI from 'pixi.js';

export class WireGraphics extends PIXI.Graphics {

	private simActiveState = false;
	private shouldHaveActiveState = false;

	public updateScale(scale: number) {
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

	public setWireState(scale: number, state: boolean) {
		this.shouldHaveActiveState = state;
		if (this.worldVisible) {
			this.applySimState(scale);
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
