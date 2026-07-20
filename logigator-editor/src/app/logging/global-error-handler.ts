import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { TranslationService } from '../translation/translation.service';
import { LoggingService } from './logging.service';
import { ToastService } from './toast.service';
import { BugReportService } from '../bug-report/bug-report.service';
import { AnalyticsService } from '../analytics/analytics.service';

/**
 * Catches every otherwise-uncaught exception and unhandled promise rejection.
 *
 * The full error is logged on *every* occurrence (the console dedupes visually).
 * The first error then opens the bug-report dialog via {@link BugReportService},
 * which owns the lockout/cooldown so a cascade of follow-on errors can't reopen
 * it. Services are resolved lazily through the injector to avoid a bootstrap DI
 * cycle (this handler is constructed very early); if the report service isn't
 * available yet, a throttled generic toast is shown instead. Everything here is
 * guarded so a failure while reporting can never re-enter this handler.
 *
 * A single correlation id is minted per error and handed to both the analytics
 * sink (as `correlation_id` on the PostHog `$exception`) and the bug report (as
 * `correlationId` in the backend payload), so a PostHog issue can be traced to
 * the full report — including the project dump — on our own backend.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private static readonly TOAST_COOLDOWN_MS = 5000;

  private readonly injector = inject(Injector);
  private lastToastAt = Number.NEGATIVE_INFINITY;

  public handleError(error: unknown): void {
    const logging = this.injector.get(LoggingService, null);
    if (logging) {
      logging.error(error, 'GlobalErrorHandler');
    } else {
      // eslint-disable-next-line no-console
      console.error('[GlobalErrorHandler]', error);
    }

    const correlationId = uuidv4();

    try {
      this.injector
        .get(AnalyticsService, null)
        ?.captureError(error, correlationId);
    } catch {
      // Analytics must never re-enter the error handler.
    }

    try {
      const bugReport = this.injector.get(BugReportService, null);
      if (bugReport) {
        bugReport.handleUncaughtError(error, correlationId);
        return;
      }
    } catch {
      // The report service isn't constructable yet (very early boot); fall
      // through to the throttled toast so the error is still surfaced.
    }

    try {
      this.fallbackToast();
    } catch {
      // Never let error reporting throw and re-enter the handler.
    }
  }

  private fallbackToast(): void {
    const now = performance.now();
    if (now - this.lastToastAt < GlobalErrorHandler.TOAST_COOLDOWN_MS) return;
    this.lastToastAt = now;

    const toast = this.injector.get(ToastService, null);
    const translation = this.injector.get(TranslationService, null);
    const message =
      translation?.translate('logging.unexpectedError') ??
      'Something went wrong.';
    toast?.error(message, 'GlobalErrorHandler');
  }
}
