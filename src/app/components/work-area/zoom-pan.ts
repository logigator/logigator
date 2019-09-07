import * as PIXI from 'pixi.js';

export class ZoomPan {

	private static MAX_ZOOM_IN = 2.5;
	private static MAX_ZOOM_OUT = 0.4;

	private _view: PIXI.Container;

	private _scale = 1;

	constructor(view: PIXI.Container) {
		this._view = view;
	}

	public translateBy(dx: number, dy: number) {
		this._view.x += dx;
		this._view.y += dy;

		if (this._view.x > 0) {
			this._view.x = 0;
		}
		if (this._view.y > 0) {
			this._view.y = 0;
		}
	}

	/**
	 * zooms by a given factor to a given point
	 * @return true if something was actually moved
	 */
	public zoomBy(scaleMultiplier: number, scaleCenterX: number, scaleCenterY: number): boolean {
		const posX = (scaleCenterX - this._view.x) / this._view.scale.x;
		const posY = (scaleCenterY - this._view.y) / this._view.scale.y;

		const newScale = this._view.scale.x * scaleMultiplier;

		if (newScale <= ZoomPan.MAX_ZOOM_OUT || newScale >= ZoomPan.MAX_ZOOM_IN) {
			return false;
		}

		this._scale = newScale;

		const newPosX = posX * this._scale + this._view.x;
		const newPosY = posY * this._scale + this._view.y;

		this._view.x -= (newPosX - scaleCenterX) ;
		this._view.y -= (newPosY - scaleCenterY) ;
		this._view.scale.x = this._scale;
		this._view.scale.y = this._scale;

		if (this.positionX > 0) {
			this._view.x = 0;
		}

		if (this.positionY > 0) {
			this._view.y = 0;
		}

		return true;
	}

	public isOnScreen(canvasHeight: number, canvasWidth: number): {start: PIXI.Point, end: PIXI.Point} {
		return {
			start: new PIXI.Point(-this.positionX / this.currentScale, -this.positionY / this.currentScale),
			end: new PIXI.Point((canvasWidth - this.positionX) / this.currentScale, (canvasHeight - this.positionY) / this.currentScale)
		};
	}

	public get positionX(): number {
		return this._view.x;
	}

	public get positionY(): number {
		return this._view.y;
	}

	public get currentScale(): number {
		return this._scale;
	}

}
