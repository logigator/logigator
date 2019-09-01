import * as PIXI from 'pixi.js';

export class ZoomPan {

	private _zoomDirty = true;

	private _positionX = 0;
	private _positionY = 0;

	private _scaleX = 1;
	private _scaleY = 1;

	private _scaleCenterX = 0;
	private _scaleCenterY = 0;

	private _atSCTransform = new PIXI.Matrix();
	private _zoomCenter = new PIXI.Matrix();
	private _scaleTransform = new PIXI.Matrix();
	private _negScaleCenter = new PIXI.Matrix();

	private _transform = new PIXI.Matrix();

	private _updateMatrix() {
		this._zoomCenter.set(1, 0, 0, 1, this._scaleCenterX, this._scaleCenterY); // Sets to translate
		this._scaleTransform.set(this._scaleX, 0, 0, this._scaleY, 0, 0); // Sets to scale
		this._negScaleCenter.set(1, 0, 0, 1, -this._scaleCenterX, -this._scaleCenterY); // Sets to translate

		// Accumulate zoom transformations.
		// atSCTransform is an intermediate accumulative matrix used for tracking the current zoom target.
		this._atSCTransform.append(this._zoomCenter);
		this._atSCTransform.append(this._scaleTransform);
		this._atSCTransform.append(this._negScaleCenter);

		// We reset Scale because atSCTransform is accumulative and has "captured" the information.
		this._scaleX = 1;
		this._scaleY = 1;

		// Tack on translation. Note: we don't append it, but concat it into a separate matrix.
		// We want to leave atSCTransform solely responsible for zooming.
		// "transform" is the final matrix.
		this._transform.set(
			this._atSCTransform.a, this._atSCTransform.b, this._atSCTransform.c, this._atSCTransform.d,
			this._atSCTransform.tx, this._atSCTransform.ty);
		// this._transform.prepend(this._atTransform);
		this._transform.translate(this._positionX, this._positionY);
	}

	public get Transform(): PIXI.Matrix {
		if (this._zoomDirty) {
			this._updateMatrix();

			// Now that we have rebuilt the transform matrix is it no longer dirty.
			this._zoomDirty = false;
		}
		return this._transform;
	}

	/**
	 * Use this if you want to manually set the positional value.
	 * You would typically use translateBy() instead.
	 */
	public setPosition(posX: number, posY: number) {
		this._positionX = posX;
		this._positionY = posY;
		this._zoomDirty = true;
	}

	public get positionX(): number {
		return this._positionX;
	}

	public get positionY(): number {
		return this._positionY;
	}

	/**
	 * A relative zoom.
	 * [delta] is a delta relative to the current scale/zoom.
	 */
	public zoomBy(deltaX: number, deltaY: number) {
		this._scaleX += deltaX;
		this._scaleY += deltaY;
		this._zoomDirty = true;
	}

	public translateBy(deltaX: number, deltaY: number) {
		this._positionX += deltaX;
		this._positionY += deltaY;
		this._zoomDirty = true;
	}

	/**
	 * Set the zoom value absolutely. If you want to zoom relative use
	 * [zoomBy]
	 */
	public set currentScale(newScale: number) {
		if (this._zoomDirty) {
			this._updateMatrix();
		}

		// We use dimensional analysis to set the scale. Remember we can't
		// just set the scale absolutely because atSCTransform is an accumulating matrix.
		// We have to take its current value and compute a new value based
		// on the passed in value.

		// Also, I can use atSCTransform.a because I don't allow rotations within in the game,
		// so the diagonal components correctly represent the matrix's current scale.
		// And because I only perform uniform scaling I can safely use just the "a" element.
		const scaleFactor: number = newScale / this._atSCTransform.a;

		this._scaleX = scaleFactor;
		this._scaleY = scaleFactor;

		this._zoomDirty = true;
	}

	public get currentScale(): number {
		return this._atSCTransform.a;
	}

	public setScaleCenter(posX: number, posY: number) {
		this._scaleCenterX = posX;
		this._scaleCenterY = posY;
		this._zoomDirty = true;
	}
}
