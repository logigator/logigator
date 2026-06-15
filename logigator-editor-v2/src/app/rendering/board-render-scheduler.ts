import { Application } from 'pixi.js';
import { Observable, Subject, takeUntil } from 'rxjs';

/** Signals a project emits to drive its board's render loop. */
export type TickerSignal = 'single' | 'on' | 'off';

/**
 * Translates a project's ticker signals into renders of its PixiJS
 * `Application`.
 *
 * The continuous ticker is reference-counted: any number of concerns (a
 * simulation run, a pan, a drag session) can hold it on at once via 'on'/'off',
 * and it stops only once the last one releases. Without this, a transient
 * interaction's 'off' (e.g. finishing a pan) would stop the ticker a running
 * simulation still needs.
 *
 * 'single' renders are coalesced onto the next animation frame. A single user
 * operation can emit many 'single' signals synchronously (e.g. undoing a move
 * re-positions N elements, each emitting one); a direct render per signal would
 * do N full-board renders for one frame's worth of change. Collapsing them to
 * one rAF-driven render means we never draw more frames than the display can
 * show, regardless of signal count.
 *
 * One scheduler instance drives one project. Create a fresh one per project
 * switch and `destroy()` the previous so its run-count and any queued frame do
 * not leak across stages.
 */
export class BoardRenderScheduler {
  private _runDepth = 0;
  private _pendingRenderHandle: number | null = null;
  private readonly _stop$ = new Subject<void>();

  constructor(
    private readonly app: Application,
    ticker$: Observable<TickerSignal>
  ) {
    ticker$
      .pipe(takeUntil(this._stop$))
      .subscribe((value) => this._handle(value));
  }

  private _handle(value: TickerSignal): void {
    switch (value) {
      case 'single':
        // Already rendering every frame while a run holds the ticker.
        if (this._runDepth === 0) {
          this._requestSingleRender();
        }
        break;
      case 'on':
        this._runDepth++;
        this.app.ticker.start();
        break;
      case 'off':
        this._runDepth = Math.max(0, this._runDepth - 1);
        if (this._runDepth === 0) {
          // This render supersedes any queued 'single' frame.
          this._cancelPendingRender();
          this.app.ticker.update();
          this.app.ticker.stop();
        }
        break;
    }
  }

  private _requestSingleRender(): void {
    if (this._pendingRenderHandle !== null) return;
    this._pendingRenderHandle = requestAnimationFrame(() => {
      this._pendingRenderHandle = null;
      // A run may have started while this was queued; it already renders.
      if (this._runDepth === 0) {
        this.app.ticker.update();
      }
    });
  }

  private _cancelPendingRender(): void {
    if (this._pendingRenderHandle !== null) {
      cancelAnimationFrame(this._pendingRenderHandle);
      this._pendingRenderHandle = null;
    }
  }

  public destroy(): void {
    this._stop$.next();
    this._stop$.complete();
    this._cancelPendingRender();
  }
}