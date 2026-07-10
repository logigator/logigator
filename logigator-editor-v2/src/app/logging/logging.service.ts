/* eslint-disable no-console */
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { LogLevel } from './log-level.enum';

/**
 * Log-line format string. `%c` applies {@link PREFIX_STYLE} to the bracketed
 * context; `%s` substitutes the context safely (even if it contains a `%`).
 * The message is always the trailing *bare* argument so the console renders it
 * natively (expandable object trees, interactive DOM view for `HTMLElement`s).
 */
const PREFIX = '%c[%s]';
const PREFIX_STYLE = 'color:#888';

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private enabled(level: LogLevel): boolean {
    return level >= environment.loggingVerbosity;
  }

  public error(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Error)) return;
    console.error(PREFIX, PREFIX_STYLE, context, message);
  }

  public warn(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Warn)) return;
    console.warn(PREFIX, PREFIX_STYLE, context, message);
  }

  public log(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Info)) return;
    console.log(PREFIX, PREFIX_STYLE, context, message);
  }

  public info(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Info)) return;
    console.info(PREFIX, PREFIX_STYLE, context, message);
  }

  public debug(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Debug)) return;
    console.debug(PREFIX, PREFIX_STYLE, context, message);
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
      this.debug(
        `${label} took ${(performance.now() - start).toFixed(2)} ms`,
        context
      );
    };
  }
}
