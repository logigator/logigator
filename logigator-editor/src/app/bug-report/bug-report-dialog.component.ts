import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LgButton,
  LgDialogContent,
  LgMessage,
  LgTextarea
} from '@logigator/ui';
import { TranslateDirective } from '../translation/translate.directive';
import { LegacyEditorService } from '../ui/legacy-editor.service';

/** Error details surfaced when the dialog is opened by the global handler. */
export interface BugReportErrorContext {
  message: string;
  file?: string;
  line?: number;
  col?: number;
  stack?: string;
  /** Shared with the matching PostHog `$exception` event for cross-reference. */
  correlationId?: string;
}

export interface BugReportDialogData {
  /** `manual` = opened from the badge; `error` = opened by an uncaught error. */
  mode: 'manual' | 'error';
  error?: BugReportErrorContext;
}

/** Max length of the free-text description, mirrored by the backend DTO. */
const MESSAGE_MAX_LENGTH = 512;

/**
 * Collects a free-text description for a bug report, opened manually or by an
 * uncaught error. Returns the typed message on send; any dismissal resolves to
 * `undefined`, meaning send nothing. `BugReportService` assembles the
 * surrounding context — this dialog owns only the message.
 */
@Component({
  selector: 'app-bug-report-dialog',
  imports: [FormsModule, LgButton, LgMessage, LgTextarea, TranslateDirective],
  templateUrl: './bug-report-dialog.component.html'
})
export class BugReportDialogComponent extends LgDialogContent<
  BugReportDialogData,
  string
> {
  private readonly legacyEditor = inject(LegacyEditorService);

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

  protected openLegacyEditor(): void {
    this.legacyEditor.open('bug-report');
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
