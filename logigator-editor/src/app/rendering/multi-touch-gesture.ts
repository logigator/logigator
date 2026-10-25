import { Point } from 'pixi.js';

/** The board operations the gesture drives, narrow enough to fake in specs. */
export interface GestureTarget {
  /** Pan by a screen-space delta. */
  pan(delta: Point): void;
  /** Zoom by a continuous factor, anchored at a screen-space center. */
  zoomBy(factor: number, center: Point): void;
  /** Cancel an in-progress single-pointer tool drag. */
  abortActiveDrag(): void;
  /** Toggle continuous rendering for the duration of the gesture. */
  setActive(active: boolean): void;
}

/**
 * Two-finger navigation in any work mode: pan by the centroid delta, pinch by
 * the spread ratio. Coordinates are canvas-local screen pixels.
 *
 * A second pointer landing activates the gesture and aborts any single-pointer
 * tool drag, so a finger never both operates a tool and navigates; the
 * cancelled drag is not resumed. Dropping below two pointers ends it.
 *
 * Filtering touch from mouse is the caller's concern.
 */
export class MultiTouchGesture {
  private readonly _pointers = new Map<number, Point>();
  private _lastCentroid: Point | null = null;
  private _lastSpread = 0;

  constructor(private readonly target: GestureTarget) {}

  /** True while two or more pointers are down (a navigation gesture is live). */
  public get isActive(): boolean {
    return this._pointers.size >= 2;
  }

  public onPointerDown(id: number, x: number, y: number): void {
    const wasActive = this.isActive;
    this._pointers.set(id, new Point(x, y));
    if (!this.isActive) return;

    if (!wasActive) {
      // Take over from any single-pointer tool drag.
      this.target.abortActiveDrag();
      this.target.setActive(true);
    }
    this._resetBaseline();
  }

  public onPointerMove(id: number, x: number, y: number): void {
    const pointer = this._pointers.get(id);
    if (!pointer) return;
    pointer.set(x, y);
    if (!this.isActive) return;

    const centroid = this._centroid();
    const spread = this._spread(centroid);
    if (this._lastCentroid) {
      this.target.pan(
        new Point(
          centroid.x - this._lastCentroid.x,
          centroid.y - this._lastCentroid.y
        )
      );
      if (this._lastSpread > 0 && spread > 0) {
        this.target.zoomBy(spread / this._lastSpread, centroid);
      }
    }
    this._lastCentroid = centroid;
    this._lastSpread = spread;
  }

  public onPointerUp(id: number): void {
    if (!this._pointers.has(id)) return;
    const wasActive = this.isActive;
    this._pointers.delete(id);

    if (this.isActive) {
      // Still multi-touch (3→2): rebase to avoid a jump.
      this._resetBaseline();
    } else if (wasActive) {
      this._lastCentroid = null;
      this._lastSpread = 0;
      this.target.setActive(false);
    }
  }

  /** Forgets all pointers (e.g. on teardown) without ending an active gesture. */
  public reset(): void {
    if (this.isActive) {
      this.target.setActive(false);
    }
    this._pointers.clear();
    this._lastCentroid = null;
    this._lastSpread = 0;
  }

  private _resetBaseline(): void {
    const centroid = this._centroid();
    this._lastCentroid = centroid;
    this._lastSpread = this._spread(centroid);
  }

  private _centroid(): Point {
    let x = 0;
    let y = 0;
    for (const p of this._pointers.values()) {
      x += p.x;
      y += p.y;
    }
    const n = this._pointers.size;
    return new Point(x / n, y / n);
  }

  /** Mean distance of the pointers from their centroid — the pinch metric. */
  private _spread(centroid: Point): number {
    let sum = 0;
    for (const p of this._pointers.values()) {
      const dx = p.x - centroid.x;
      const dy = p.y - centroid.y;
      sum += Math.sqrt(dx * dx + dy * dy);
    }
    return sum / this._pointers.size;
  }
}
