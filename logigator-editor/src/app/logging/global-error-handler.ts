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
 * Every occurrence is logged; the first then opens the bug-report dialog via
 * {@link BugReportService}, which owns the lockout and cooldown. Services are
 * resolved lazily through the injector to avoid a bootstrap DI cycle, since
 * this handler is constructed very early; before the report service exists, a
 * throttled generic toast stands in. Everything is guarded so a failure while
 * reporting cannot re-enter the handler.
 *
 * One correlation id per error goes to both the PostHog `$exception` and the
 * bug report, so an issue can be traced to the full report — project dump
 * included — on our own backend.
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
      // Not constructable yet (very early boot); fall through to the
      // throttled toast so the error is still surfaced.
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
