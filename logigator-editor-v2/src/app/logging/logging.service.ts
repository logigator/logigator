/* eslint-disable no-console */
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { LogLevel } from './log-level.enum';

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private enabled(level: LogLevel): boolean {
    return level >= environment.loggingVerbosity;
  }

  public error(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Error)) return;
    console.error('[%s] %o', context, message);
  }

  public warn(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Warn)) return;
    console.warn('[%s] %o', context, message);
  }

  public log(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Info)) return;
    console.log('[%s] %o', context, message);
  }

  public info(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Info)) return;
    console.info('[%s] %o', context, message);
  }

  public debug(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Debug)) return;
    console.debug('[%s] %o', context, message);
  }

  /**
   * Starts a timer and returns a function that, when called, logs the elapsed
   * milliseconds at debug level. Use to trace how long an operation took:
   *
   * ```ts
   * const done = this.logging.time('compile board', 'BoardCompiler');
   * // …work…
   * done(); // → [BoardCompiler] compile board took 12.34 ms
   * ```
   */
  public time(label: string, context: string): () => void {
    const start = performance.now();
    return () => {
      this.debug(`${label} took ${(performance.now() - start).toFixed(2)} ms`, context);
    };
  }
}
