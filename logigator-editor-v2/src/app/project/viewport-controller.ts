import { Container, Matrix, Point } from 'pixi.js';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Grid } from '../rendering/grid';

/**
 * The zoom ladder: every stepped zoom scale is `ZOOM_STEP_BASE^step` with
 * `step ∈ [ZOOM_STEP_MIN, ZOOM_STEP_MAX]`. Scale-keyed caches (shared
 * GraphicsContexts) only ever see these discrete scales from live zooming, so
 * offscreen consumers quantize onto the same ladder to reuse them.
 */
export const ZOOM_STEP_BASE = 1.2;
export const ZOOM_STEP_MIN = -12;
export const ZOOM_STEP_MAX = 5;

/** Full camera state: what a viewport-dependent overlay needs to draw itself. */
export interface ViewportState {
  /** Grid coordinates of the viewport's top-left corner. */
  gridOrigin: Point;
  /** Zoom factor (1 = 100%). */
  scale: number;
  /** Viewport size in screen px. */
  viewportSize: Point;
}

export class ViewportController {
  private readonly _scaleStepAmount = ZOOM_STEP_BASE;
  private readonly _scaleStepMin = ZOOM_STEP_MIN;
  private readonly _scaleStepMax = ZOOM_STEP_MAX;
  private _scaleStep = 0;

  private _viewPortSize = new Point(0, 0);
  private readonly _positionChange$ = new Subject<Point>();
  private readonly _viewportChange$ = new Subject<ViewportState>();

  constructor(
    private readonly _container: Container,
    private readonly _grid: Grid,
    private readonly _onApplyScale: (scale: number) => void
  ) {}

  public resizeViewport(width: number, height: number): void {
    this._viewPortSize.set(width, height);
    this._grid.resizeViewport(this._viewPortSize);
    // The grid position is untouched, so only the viewport state changes.
    this._viewportChange$.next(this.viewportState);
  }

  public pan(delta: Point): void {
    this.setPosition(delta.add(this._container.position));
  }

  public setPosition(point: Point): void {
    this._applyPosition(point);
    this._emitChange();
  }

  /** Moves the camera without emitting — `_updateScale` composes position and
   *  scale mutations and emits one consistent state at the end. */
  private _applyPosition(point: Point): void {
    this._container.position.copyFrom(point);
    this._grid.updatePosition(this._container.position);
  }

  private _emitChange(): void {
    this._positionChange$.next(this.gridPosition);
    this._viewportChange$.next(this.viewportState);
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

  /**
   * Continuous zoom for pinch gestures: multiplies the current scale by
   * `factor`, clamped to the same bounds the stepped zoom respects, anchored at
   * `center`. Resyncs the discrete step so a later stepped zoomIn/zoomOut or a
   * +/- button continues from the pinched scale rather than snapping back.
   */
  public zoomBy(factor: number, center?: Point): void {
    const min = Math.pow(this._scaleStepAmount, this._scaleStepMin);
    const max = Math.pow(this._scaleStepAmount, this._scaleStepMax);
    const target = Math.min(
      Math.max(this._container.scale.x * factor, min),
      max
    );
    this._updateScale(target, center);
    this._scaleStep = Math.round(
      Math.log(target) / Math.log(this._scaleStepAmount)
    );
  }

  public get positionChange$(): Observable<Point> {
    return this._positionChange$.asObservable();
  }

  public get viewportChange$(): Observable<ViewportState> {
    return this._viewportChange$.asObservable();
  }

  public get viewportState(): ViewportState {
    const factor = this._container.scale.x * environment.gridSize;
    return {
      gridOrigin: new Point(
        -this._container.position.x / factor,
        -this._container.position.y / factor
      ),
      scale: this._container.scale.x,
      viewportSize: this._viewPortSize.clone()
    };
  }

  public get gridPosition(): Point {
    return this._container.position.multiplyScalar(
      1 / (this._container.scale.x * environment.gridSize)
    );
  }

  public dispose(): void {
    this._positionChange$.complete();
    this._viewportChange$.complete();
  }

  private _updateScale(
    scale: number,
    center: Point = this._viewPortSize.multiplyScalar(0.5)
  ): void {
    if (scale === this._container.scale.x) return;

    this._applyPosition(
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
    this._emitChange();
  }
}
