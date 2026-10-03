import { InjectionToken, Provider } from '@angular/core';

/**
 * Optional observer of dialog lifecycles, notified for every open whose config
 * carries a {@link DialogConfig.telemetryId}. The library never interprets the
 * id, and a dialog without one is invisible here.
 */
export interface LgDialogTelemetry {
  /** A dialog with `id` has been opened. */
  onOpen(id: string): void;
  /**
   * The dialog has torn down, by any path. `resolved` says only whether
   * `close()` carried a result — not whether the task completed: a read-only
   * dialog, or one committing through its own API, closes without one.
   */
  onClose(id: string, resolved: boolean): void;
}

export const LG_DIALOG_TELEMETRY = new InjectionToken<LgDialogTelemetry>(
  'lg-dialog-telemetry'
);

/**
 * Registers an app-wide {@link LgDialogTelemetry} observer. A plain factory
 * suffices: the observer is consulted per dialog, so it may resolve its
 * dependencies once and hold them.
 */
export function provideLgDialogTelemetry(
  factory: () => LgDialogTelemetry
): Provider[] {
  return [{ provide: LG_DIALOG_TELEMETRY, useFactory: factory }];
}
