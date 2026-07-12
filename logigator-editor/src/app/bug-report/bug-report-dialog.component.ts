import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDialogContent,
  LgMessage,
  LgTextarea
} from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';

/** Error details surfaced when the dialog is opened by the global handler. */
export interface BugReportErrorContext {
  message: string;
  file?: string;
  line?: number;
  col?: number;
  stack?: string;
}

export interface BugReportDialogData {
  /** `manual` = opened from the badge; `error` = opened by an uncaught error. */
  mode: 'manual' | 'error';
  error?: BugReportErrorContext;
}

/** Max length of the free-text description, mirrored by the backend DTO. */
const MESSAGE_MAX_LENGTH = 512;

/**
 * Collects a free-text description for a bug report. Opened either manually
 * from the badge or automatically when an uncaught error is caught. Returns the
 * typed message on send; dismissing (✕ / Escape / backdrop / Cancel) resolves
 * to `undefined`, which the caller treats as "send nothing". The surrounding
 * context (project, client info, logs, error) is assembled by
 * `BugReportService` — this dialog only owns the message.
 */
@Component({
  selector: 'app-bug-report-dialog',
  imports: [FormsModule, LgButton, LgMessage, LgTextarea, TranslocoDirective],
  templateUrl: './bug-report-dialog.component.html'
})
export class BugReportDialogComponent extends LgDialogContent<
  BugReportDialogData,
  string
> {
  protected readonly maxLength = MESSAGE_MAX_LENGTH;
  protected readonly mode = this.dialogData?.mode ?? 'manual';
  protected readonly error = this.dialogData?.error;

  protected readonly message = signal('');
  protected readonly canSend = computed(
    () => this.mode === 'error' || this.message().trim().length > 0
  );

  protected send(): void {
    if (!this.canSend()) return;
    this.dialogRef.close(this.message().trim());
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
