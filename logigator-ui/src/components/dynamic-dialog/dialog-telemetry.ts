import { InjectionToken, Provider } from '@angular/core';

/**
 * Optional observer of dialog lifecycles, notified for every
 * {@link DialogService.open} whose config carries a
 * {@link DialogConfig.telemetryId}. Lets an app measure how often a dialog is
 * opened — including the opens that are abandoned — without threading a
 * subscription through each call site.
 *
 * The library never interprets the id, and dialogs without one are invisible
 * here.
 */
export interface LgDialogTelemetry {
  /** A dialog with `id` has been opened. */
  onOpen(id: string): void;
  /**
   * The dialog has torn down, by any path: an explicit `close(result)`, the
   * close button, Escape, the backdrop, or overlay disposal.
   *
   * `resolved` says whether `close()` carried a result — nothing more. It is
   * *not* a task-completion signal: a read-only dialog always closes without
   * one, and a dialog that commits its work through its own API (rather than
   * through the close result) does too.
   */
  onClose(id: string, resolved: boolean): void;
}

export const LG_DIALOG_TELEMETRY = new InjectionToken<LgDialogTelemetry>(
  'lg-dialog-telemetry'
);

/**
 * Registers an app-wide {@link LgDialogTelemetry} observer. A plain factory
 * suffices: the observer is consulted per dialog, so it may resolve its own
 * dependencies once and hold them.
 */
export function provideLgDialogTelemetry(
  factory: () => LgDialogTelemetry
): Provider[] {
  return [{ provide: LG_DIALOG_TELEMETRY, useFactory: factory }];
}
