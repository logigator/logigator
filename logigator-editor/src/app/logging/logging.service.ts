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

/** How many recent entries the diagnostic ring buffer keeps. */
const LOG_BUFFER_SIZE = 100;
/** Max characters kept per buffered entry (stacks and objects are truncated). */
const LOG_ENTRY_MAX_LENGTH = 600;

const LEVEL_LABEL: Record<LogLevel, string> = {
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Warn]: 'WARN',
  [LogLevel.Error]: 'ERROR',
  [LogLevel.Silent]: 'SILENT'
};

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  /**
   * Rolling record of recent log lines, kept independently of the console
   * verbosity so a bug report carries the run-up to an error even when those
   * lines were never printed. Debug entries are excluded — they are too noisy
   * to be useful history.
   */
  private readonly buffer: string[] = [];

  /**
   * The last buffered entry's message content (without its timestamp), so
   * consecutive duplicates collapse on the message rather than on the
   * timestamped line — which would always differ and defeat the dedupe.
   */
  private lastContent: string | undefined;

  private enabled(level: LogLevel): boolean {
    return level >= environment.loggingVerbosity;
  }

  public error(message: unknown, context: string): void {
    this.record(LogLevel.Error, message, context);
    if (!this.enabled(LogLevel.Error)) return;
    console.error(PREFIX, PREFIX_STYLE, context, message);
  }

  public warn(message: unknown, context: string): void {
    this.record(LogLevel.Warn, message, context);
    if (!this.enabled(LogLevel.Warn)) return;
    console.warn(PREFIX, PREFIX_STYLE, context, message);
  }

  public log(message: unknown, context: string): void {
    this.record(LogLevel.Info, message, context);
    if (!this.enabled(LogLevel.Info)) return;
    console.log(PREFIX, PREFIX_STYLE, context, message);
  }

  public info(message: unknown, context: string): void {
    this.record(LogLevel.Info, message, context);
    if (!this.enabled(LogLevel.Info)) return;
    console.info(PREFIX, PREFIX_STYLE, context, message);
  }

  public debug(message: unknown, context: string): void {
    if (!this.enabled(LogLevel.Debug)) return;
    console.debug(PREFIX, PREFIX_STYLE, context, message);
  }

  /** The buffered recent log lines, oldest first, as one text block. */
  public recentLogs(): string {
    return this.buffer.join('\n');
  }

  private record(level: LogLevel, message: unknown, context: string): void {
    const raw = `[${LEVEL_LABEL[level]}][${context}] ${this.stringify(message)}`;
    const content =
      raw.length > LOG_ENTRY_MAX_LENGTH
        ? `${raw.slice(0, LOG_ENTRY_MAX_LENGTH)}…`
        : raw;
    // Collapse consecutive duplicates so an error storm can't evict the run-up
    // history this buffer exists to preserve.
    if (this.lastContent === content) return;
    this.lastContent = content;
    // Prefix a UTC time-of-day so a bug report shows when each line occurred
    // relative to the crash. Matches the UTC `Date:` header of the report.
    const timestamp = new Date().toISOString().slice(11, 23);
    this.buffer.push(`${timestamp} ${content}`);
    if (this.buffer.length > LOG_BUFFER_SIZE) this.buffer.shift();
  }

  /** Best-effort one-line-ish rendering of an arbitrary logged value. */
  private stringify(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) {
      return message.stack ?? `${message.name}: ${message.message}`;
    }
    try {
      return JSON.stringify(message) ?? String(message);
    } catch {
      return String(message);
    }
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
