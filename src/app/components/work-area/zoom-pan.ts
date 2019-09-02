import * as PIXI from 'pixi.js';

export class ZoomPan {

	private _view: PIXI.Container;

	private _scale = 1;

	constructor(view: PIXI.Container) {
		this._view = view;
		this._view.x = 10;
		this._view.y = 10;
	}

	public translateBy(dx: number, dy: number) {
		if (this.positionX + dx > 10) {
			dx = 0;
		}
		if (this.positionY + dy > 10) {
			dy = 0;
		}
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

		if (this.positionX > 10) {
			this._view.x = 0;
		}

		if (this.positionY > 10) {
			this._view.y = 0;
		}
	}

	public isOnScreen(canvasHeight: number, canvasWidth: number): {startX: number, startY: number, endX: number, endY: number} {
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
