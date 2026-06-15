import {
  ChangeDetectionStrategy,
  Component,
  input,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';
import { Ticker } from 'pixi.js';

/**
 * Debug overlay showing the board's render frame rate.
 *
 * `Ticker.FPS` is the instantaneous 1000/elapsedMS of the last frame, so on
 * imperfect vsync it quantizes to the display grid (e.g. 144/72) rather than
 * the true rate. This counts rendered frames over each sample window and
 * divides by real elapsed time for an averaged, accurate reading. Only
 * continuously-driven frames count; one-off `ticker.update()` renders (idle/
 * single) run with `started === false` and are excluded so sparse renders
 * don't read as a near-zero rate.
 */
@Component({
  selector: 'app-fps-counter',
  imports: [],
  templateUrl: './fps-counter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FpsCounterComponent implements OnInit, OnDestroy {
  private static readonly SAMPLE_INTERVAL_MS = 500;

  public readonly ticker = input.required<Ticker>();

  protected readonly fps = signal(0);

  private interval: ReturnType<typeof setInterval> | null = null;
  private frameCount = 0;
  private lastSampleTime = 0;

  ngOnInit(): void {
    this.lastSampleTime = performance.now();
    this.ticker().add(this.countFrame);
    this.interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - this.lastSampleTime;
      this.lastSampleTime = now;
      this.fps.set(
        elapsed > 0 ? Math.round((this.frameCount * 1000) / elapsed) : 0
      );
      this.frameCount = 0;
    }, FpsCounterComponent.SAMPLE_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
    }
    this.ticker().remove(this.countFrame);
  }

  private readonly countFrame = (): void => {
    if (this.ticker().started) {
      this.frameCount++;
    }
  };
}