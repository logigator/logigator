import { Container, Matrix, Point } from 'pixi.js';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Grid } from '../rendering/grid';

export class ViewportController {
	private readonly _scaleStepAmount = 1.2;
	private readonly _scaleStepMin = -12;
	private readonly _scaleStepMax = 5;
	private _scaleStep = 0;

	private _viewPortSize = new Point(0, 0);
	private readonly _positionChange$ = new Subject<Point>();

	constructor(
		private readonly _container: Container,
		private readonly _grid: Grid,
		private readonly _onApplyScale: (scale: number) => void
	) {}

	public resizeViewport(width: number, height: number): void {
		this._viewPortSize.set(width, height);
		this._grid.resizeViewport(this._viewPortSize);
	}

	public pan(delta: Point): void {
		this.setPosition(delta.add(this._container.position));
	}

	public setPosition(point: Point): void {
		this._container.position.copyFrom(point);
		this._grid.updatePosition(this._container.position);
		this._positionChange$.next(this.gridPosition);
	}

	public get zoomOutPossible(): boolean {
		return this._scaleStep > this._scaleStepMin;
	}

	public get zoomInPossible(): boolean {
		return this._scaleStep < this._scaleStepMax;
	}

	public zoomIn(center?: Point): void {
		if (!this.zoomInPossible) return;
		this._updateScale(
			Math.pow(this._scaleStepAmount, ++this._scaleStep),
			center
		);
	}

	public zoomOut(center?: Point): void {
		if (!this.zoomOutPossible) return;
		this._updateScale(
			Math.pow(this._scaleStepAmount, --this._scaleStep),
			center
		);
	}

	public zoom100(center?: Point): void {
		this._scaleStep = 0;
		this._updateScale(1, center);
	}

	public get positionChange$(): Observable<Point> {
		return this._positionChange$.asObservable();
	}

	public get gridPosition(): Point {
		return this._container.position.multiplyScalar(
			1 / (this._container.scale.x * environment.gridSize)
		);
	}

	private _updateScale(
		scale: number,
		center: Point = this._viewPortSize.multiplyScalar(0.5)
	): void {
		if (scale === this._container.scale.x) return;

		this.setPosition(
			new Matrix()
				.translate(-center.x, -center.y)
				.scale(1 / this._container.scale.x, 1 / this._container.scale.y)
				.scale(scale, scale)
				.translate(center.x, center.y)
				.apply(this._container.position)
		);

		this._container.scale.set(scale);
		this._grid.updateScale(scale);
		this._onApplyScale(scale);
	}
}
