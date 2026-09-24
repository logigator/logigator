import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { DialogService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent, DialogId } from '../analytics/analytics.mapping';
import { ReportErrorApiService } from '../api/services/report-error-api.service';
import type { ReportErrorRequest } from '@logigator/contract';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectDumpService } from '../persistence/dump/project-dump.service';
import { ProjectService } from '../project/project.service';
import { LoggingService } from '../logging/logging.service';
import { ToastService } from '../logging/toast.service';
import { ClientInfoService } from './client-info.service';
import {
  BugReportDialogComponent,
  type BugReportDialogData,
  type BugReportErrorContext
} from './bug-report-dialog.component';

const CONTEXT = 'BugReportService';

/**
 * The bounds `reportErrorRequestSchema` enforces, mirrored here so an oversized
 * field is trimmed instead of failing the whole report. `keepHead`/`keepTail`
 * emit exactly `max` characters, which the schema accepts, so these match the
 * contract rather than sitting under it.
 */
const MESSAGE_MAX = 4000;
const STACK_MAX = 20_000;
const LOGS_MAX = 100_000;
const USER_AGENT_MAX = 500;
/**
 * The contract's `projectDump` bound. This one gates rather than truncates — a
 * dump over it is dropped in favour of the next-richest payload — so it has to
 * match the schema exactly, or the fallback ladder keeps handing the server
 * something it refuses.
 */
const DUMP_MAX = 2_000_000;

/**
 * How long error-triggered reports stay suppressed after one closes, so a
 * cascade of follow-on errors cannot reopen the dialog repeatedly.
 */
const ERROR_REPORT_COOLDOWN_MS = 15000;

/**
 * Owns the bug-report flow: opening the dialog (manually, or from an uncaught
 * error), assembling the payload (client environment, project dump, recent
 * logs, error context) and submitting it.
 *
 * Error-triggered reports use leading-edge lockout: the first error opens and
 * locks the dialog so the follow-on cascade is swallowed, and a cooldown after
 * close prevents immediate re-opening. Manual reports bypass the cooldown but
 * still respect the lock.
 */
@Injectable({ providedIn: 'root' })
export class BugReportService {
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly api = inject(ReportErrorApiService);
  private readonly persistence = inject(PersistenceService);
  private readonly projectDump = inject(ProjectDumpService);
  private readonly projectService = inject(ProjectService);
  private readonly clientInfo = inject(ClientInfoService);
  private readonly logging = inject(LoggingService);
  private readonly toast = inject(ToastService);
  private readonly analytics = inject(AnalyticsService);

  /** True while a report dialog is open — blocks a second one. */
  private active = false;
  /** `performance.now()` before which error-triggered reports are suppressed. */
  private suppressErrorsUntil = 0;

  /** Opens the report dialog from the badge. */
  public openManualReport(): void {
    void this.openDialog({ mode: 'manual' }).catch((err: unknown) =>
      this.logging.error(err, CONTEXT)
    );
  }

  /**
   * Opens the report dialog for an uncaught error, subject to the lockout and
   * cooldown. Safe to call on every error; only the first of a burst gets
   * through.
   */
  public handleUncaughtError(error: unknown, correlationId?: string): void {
    if (this.active || performance.now() < this.suppressErrorsUntil) return;
    const context = this.errorContext(error);
    if (correlationId) context.correlationId = correlationId;
    void this.openDialog({ mode: 'error', error: context })
      .catch((err: unknown) => this.logging.error(err, CONTEXT))
      .finally(() => {
        this.suppressErrorsUntil = performance.now() + ERROR_REPORT_COOLDOWN_MS;
      });
  }

  private async openDialog(data: BugReportDialogData): Promise<void> {
    if (this.active) return;
    // Lock before opening: if the modal synchronously re-runs change
    // detection and re-throws, the lock is already in place to swallow it.
    this.active = true;
    try {
      const ref = this.dialogService.open(BugReportDialogComponent, {
        header: this.translation.translate('bugReport.title'),
        width: '36rem',
        modal: true,
        closable: true,
        // Split by mode rather than carried as a property: a dismissal emits
        // no event of ours, and manual-vs-error is the distinction worth
        // having on an abandoned report.
        telemetryId:
          data.mode === 'error'
            ? DialogId.BugReportError
            : DialogId.BugReportManual,
        data
      });
      if (!ref) return;

      const message = await firstValueFrom(ref.onClose);
      // Dismissing resolves to `undefined`; only an explicit send submits.
      if (typeof message === 'string') {
        const payload = this.buildPayload(message, data.error);
        this.analytics.capture(AnalyticsEvent.BugReportSubmitted, {
          mode: data.mode,
          correlation_id: payload.correlationId
        });
        this.submit(payload);
      }
    } finally {
      this.active = false;
    }
  }

  private submit(payload: ReportErrorRequest): void {
    this.api.report(payload).subscribe({
      next: () =>
        this.toast.success(
          this.translation.translate('bugReport.sent'),
          CONTEXT
        ),
      error: (err: unknown) =>
        this.toast.error(
          this.translation.translate('bugReport.failed'),
          CONTEXT,
          err
        )
    });
  }

  private buildPayload(
    userMessage: string,
    error?: BugReportErrorContext
  ): ReportErrorRequest {
    const payload: ReportErrorRequest = {
      source: 'editor-v2',
      // Links the report to the matching PostHog event: an error report
      // reuses the id minted for its `$exception`, a manual report mints one.
      correlationId: error?.correlationId ?? uuidv4(),
      userMessage: userMessage || undefined,
      // The raw UA is the most reliable client field; `client` also carries a
      // coarse parsed browser/OS, which a mislabelled parse can get wrong.
      userAgent: this.keepHead(navigator.userAgent, USER_AGENT_MAX),
      client: this.clientInfo.collect()
    };

    const logs = this.logging.recentLogs();
    if (logs) payload.logs = this.keepTail(logs, LOGS_MAX);

    if (error) {
      payload.message = this.keepHead(error.message, MESSAGE_MAX);
      payload.file = error.file;
      payload.line = error.line;
      payload.col = error.col;
      if (error.stack) payload.stack = this.keepHead(error.stack, STACK_MAX);
    }

    const dump = this.buildProjectDump();
    if (dump) payload.projectDump = dump;

    return payload;
  }

  /**
   * The richest project payload that fits: the full debug dump (circuit + undo
   * history), degrading to the plain circuit document and finally to bare size
   * metrics, so the biggest projects still arrive with something.
   */
  private buildProjectDump(): string | undefined {
    const project = this.projectService.activeProject();
    if (!project) return undefined;

    try {
      const dump = JSON.stringify(this.projectDump.buildDump(project));
      if (dump.length <= DUMP_MAX) return dump;
      this.logging.warn(
        `Project dump too large (${dump.length} bytes); attaching the circuit only.`,
        CONTEXT
      );
    } catch (err) {
      this.logging.warn(err, CONTEXT);
    }

    try {
      const circuit = this.persistence.exportProjectToJson(project);
      if (circuit.length <= DUMP_MAX) return circuit;
    } catch (err) {
      this.logging.warn(err, CONTEXT);
    }

    try {
      return JSON.stringify({
        note: 'project too large to attach',
        components: [...project.components].length,
        wires: [...project.wires].length
      });
    } catch {
      return undefined;
    }
  }

  /** Normalizes whatever the error handler received into a report context. */
  private errorContext(error: unknown): BugReportErrorContext {
    const unwrapped = this.unwrapError(error);
    if (unwrapped instanceof Error) {
      return {
        message: unwrapped.message || String(unwrapped),
        stack: unwrapped.stack
      };
    }
    return {
      message:
        typeof unwrapped === 'string' ? unwrapped : this.safeString(unwrapped)
    };
  }

  /** Peels the common Angular/zone error wrappers to the underlying error. */
  private unwrapError(error: unknown): unknown {
    const wrapper = error as {
      rejection?: unknown;
      ngOriginalError?: unknown;
    } | null;
    return wrapper?.rejection ?? wrapper?.ngOriginalError ?? error;
  }

  private safeString(value: unknown): string {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }

  /** Keeps the leading `max` characters (top of a stack / start of a message). */
  private keepHead(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  /** Keeps the trailing `max` characters (the most recent log lines). */
  private keepTail(value: string, max: number): string {
    return value.length > max
      ? `…${value.slice(value.length - max + 1)}`
      : value;
  }
}
