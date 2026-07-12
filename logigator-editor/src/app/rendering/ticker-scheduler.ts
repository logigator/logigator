import { Ticker } from 'pixi.js';
import { Observable, Subject, takeUntil } from 'rxjs';

/** Signals a project emits to drive its board's render loop. */
export type TickerSignal = 'single' | 'on' | 'off';

export class TickerScheduler {
  private _runDepth = 0;
  private _pendingRenderHandle: number | null = null;
  private readonly _stop$ = new Subject<void>();

  constructor(
    private readonly ticker: Ticker,
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
        this.ticker.start();
        break;
      case 'off':
        this._runDepth = Math.max(0, this._runDepth - 1);
        if (this._runDepth === 0) {
          // This render supersedes any queued 'single' frame.
          this._cancelPendingRender();
          this.ticker.update();
          this.ticker.stop();
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
        this.ticker.update();
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
