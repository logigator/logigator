import { Container, Matrix, Point, Rectangle } from 'pixi.js';
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
  private readonly _viewportChange$ = new Subject<ViewportState>();

  // The exact camera position — the source of truth for all camera math
  // (pan accumulation, zoom anchoring, the grid-space accessors). The
  // container only ever receives its device-pixel-snapped mirror (see
  // _applyPosition), so sub-pixel pan deltas keep accumulating here and
  // zoom cycles never collect snapping error.
  private readonly _truePosition = new Point(0, 0);

  constructor(
    private readonly _container: Container,
    private readonly _grid: Grid,
    private readonly _onApplyScale: (scale: number) => void,
    // Requests one on-screen frame after a zoom. Pans don't request one —
    // they only happen inside gestures that already hold the ticker on.
    private readonly _requestRender: () => void
  ) {}

  public resizeViewport(width: number, height: number): void {
    this._viewPortSize.set(width, height);
    this._grid.resizeViewport(this._viewPortSize);
    this._viewportChange$.next(this.viewportState);
  }

  public pan(delta: Point): void {
    this.setPosition(delta.add(this._truePosition));
  }

  public setPosition(point: Point): void {
    this._applyPosition(point);
    this._viewportChange$.next(this.viewportState);
  }

  /** Moves the camera without emitting — `_updateScale` composes position and
   *  scale mutations and emits one consistent state at the end. */
  private _applyPosition(point: Point): void {
    this._truePosition.copyFrom(point);
    // Snap the rendered translation to whole device pixels. Wires are
    // one-device-pixel antialiased hairlines, so a fractional translation
    // sweeps their pixel-coverage phase while panning — they visibly shimmer
    // brighter/dimmer. Snapping freezes the phase; _truePosition keeps the
    // exact camera so the snap never accumulates into drift.
    const dpr = window.devicePixelRatio || 1;
    this._container.position.set(
      Math.round(point.x * dpr) / dpr,
      Math.round(point.y * dpr) / dpr
    );
    this._grid.updatePosition(this._container.position);
  }

  public get zoomOutPossible(): boolean {
    return this._scaleStep > this._scaleStepMin;
  }

  public get zoomInPossible(): boolean {
    return this._scaleStep < this._scaleStepMax;
  }

  public zoomIn(center?: Point): void {
    if (this.zoomInPossible) {
      this._updateScale(
        Math.pow(this._scaleStepAmount, ++this._scaleStep),
        center
      );
    }
    this._requestRender();
  }

  public zoomOut(center?: Point): void {
    if (this.zoomOutPossible) {
      this._updateScale(
        Math.pow(this._scaleStepAmount, --this._scaleStep),
        center
      );
    }
    this._requestRender();
  }

  public zoom100(center?: Point): void {
    this._scaleStep = 0;
    this._updateScale(1, center);
    this._requestRender();
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
    this._requestRender();
  }

  /**
   * Frames a grid-space rectangle: zooms so it fits the viewport (with
   * `paddingGrid` grid units of clearance on every side) and centres it. The
   * scale is continuous — clamped to the same bounds the stepped zoom
   * respects, optionally capped by `maxZoom` so framing a tiny target does not
   * zoom to the maximum — and the discrete step is resynced afterwards, like
   * {@link zoomBy}, so a later stepped zoom continues from here.
   *
   * A degenerate rectangle (zero width and height, e.g. a single element's
   * point bounds) frames at `maxZoom` or the ladder maximum. Inert while the
   * viewport has no size yet.
   */
  public fitBounds(
    gridRect: Rectangle,
    paddingGrid = 0,
    maxZoom?: number
  ): void {
    if (this._viewPortSize.x <= 0 || this._viewPortSize.y <= 0) return;

    const width = gridRect.width + 2 * paddingGrid;
    const height = gridRect.height + 2 * paddingGrid;
    const fitX =
      width > 0
        ? this._viewPortSize.x / (width * environment.gridSize)
        : Infinity;
    const fitY =
      height > 0
        ? this._viewPortSize.y / (height * environment.gridSize)
        : Infinity;

    const min = Math.pow(this._scaleStepAmount, this._scaleStepMin);
    const max = Math.pow(this._scaleStepAmount, this._scaleStepMax);
    const target = Math.min(
      Math.max(Math.min(fitX, fitY, maxZoom ?? Infinity), min),
      max
    );

    this._writeScale(target);
    // Place the rect's centre at the viewport's centre: a grid point p renders
    // at `position + p · scale · gridSize`.
    const factor = target * environment.gridSize;
    this._applyPosition(
      new Point(
        this._viewPortSize.x / 2 - (gridRect.x + gridRect.width / 2) * factor,
        this._viewPortSize.y / 2 - (gridRect.y + gridRect.height / 2) * factor
      )
    );
    this._scaleStep = Math.round(
      Math.log(target) / Math.log(this._scaleStepAmount)
    );
    this._viewportChange$.next(this.viewportState);
    this._requestRender();
  }

  public get viewportChange$(): Observable<ViewportState> {
    return this._viewportChange$.asObservable();
  }

  public get viewportState(): ViewportState {
    const factor = this._container.scale.x * environment.gridSize;
    return {
      gridOrigin: new Point(
        -this._truePosition.x / factor,
        -this._truePosition.y / factor
      ),
      scale: this._container.scale.x,
      viewportSize: this._viewPortSize.clone()
    };
  }

  /**
   * Writes the viewport rectangle in grid coordinates into `out` and returns
   * it. Allocation-free so the per-frame cull pass can reuse one rectangle.
   */
  public gridView(out: Rectangle): Rectangle {
    const factor = this._container.scale.x * environment.gridSize;
    out.x = -this._truePosition.x / factor;
    out.y = -this._truePosition.y / factor;
    out.width = this._viewPortSize.x / factor;
    out.height = this._viewPortSize.y / factor;
    return out;
  }

  public get gridPosition(): Point {
    return this._truePosition.multiplyScalar(
      1 / (this._container.scale.x * environment.gridSize)
    );
  }

  public dispose(): void {
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
        .apply(this._truePosition)
    );

    this._writeScale(scale);
    this._viewportChange$.next(this.viewportState);
  }

  /** Applies a scale to the container, the grid, and the scale listeners. */
  private _writeScale(scale: number): void {
    this._container.scale.set(scale);
    this._grid.updateScale(scale);
    this._onApplyScale(scale);
  }
}
