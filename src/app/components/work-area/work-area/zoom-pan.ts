import * as PIXI from 'pixi.js';

export class ZoomPan {

	private _view: PIXI.Container;

	private _scale = 1;

	constructor(view: PIXI.Container) {
		this._view = view;
	}

	public translateBy(dx: number, dy: number) {
		this._view.x += dx;
		this._view.y += dy;
	}

	public zoomBy(scaleMultiplier: number, scaleCenterX: number, scaleCenterY: number) {
		const posX = (scaleCenterX - this._view.x) / this._view.scale.x;
		const posY = (scaleCenterY - this._view.y) / this._view.scale.y;

		this._scale = this._view.scale.x * scaleMultiplier;

		const newPosX = posX * this._scale + this._view.x;
		const newPosY = posY * this._scale + this._view.y;

		this._view.x -= (newPosX - scaleCenterX) ;
		this._view.y -= (newPosY - scaleCenterY) ;
		this._view.scale.x = this._scale;
		this._view.scale.y = this._scale;
	}

	public isOnScreen(canvasHeight: number, canvasWidth: number) {
		return {
			startX: -this.positionX,
			startY: -this.positionY,
			endX: (canvasWidth - this.positionX) / this.currentScale,
			endY: (canvasHeight - this.positionY) / this.currentScale
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
