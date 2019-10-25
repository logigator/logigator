import * as PIXI from 'pixi.js';

export class LGraphics extends PIXI.Graphics {

	public updateScale(scale: number) {

		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			data.lineStyle.width = 1 / scale;
		}
		this.geometry.invalidate();
	}

	public setWireState(scale: number, state: boolean) {
		// @ts-ignore
		for (const data of this.geometry.graphicsData) {
			if (state) {
				data.lineStyle.width = 3 / scale;
			} else {
				data.lineStyle.width = 1 / scale;
			}
		}
		this.geometry.invalidate();
	}
}
