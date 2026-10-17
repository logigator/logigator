import { inject, Injectable } from '@angular/core';
import { ToastAction, ToastService as UiToastService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { LoggingService } from './logging.service';

/**
 * UI-facing service for translated toast notifications. Inject
 * {@link LoggingService} directly for console-only output.
 *
 * Every toast already mirrors to {@link LoggingService}, so callers must not
 * log the same thing again. The mandatory `context` names the originating
 * class, since bundling obscures the call site; the optional trailing `cause`
 * on `error`/`warn` is logged in place of the user-facing message.
 * `error`/`warn` log at their own level, `success`/`info` at info.
 *
 * Error toasts also emit {@link AnalyticsEvent.ErrorShown}, so failures the app
 * *handles* — which never become a PostHog `$exception` — stay visible in
 * analytics. Context, message and cause identity travel, truncated by the
 * sanitizer; this is the one place free-form text reaches analytics.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly messageService = inject(UiToastService);
  private readonly translation = inject(TranslationService);
  private readonly logging = inject(LoggingService);
  private readonly analytics = inject(AnalyticsService);

  public error(message: string, context: string, cause?: unknown): void {
    this.logging.error(cause ?? message, context);
    this.analytics.capture(AnalyticsEvent.ErrorShown, {
      context,
      message,
      cause: formatCause(cause)
    });
    this.messageService.add({
      severity: 'danger',
      summary: this.translation.translate('logging.error'),
      detail: message,
      life: 8000
    });
  }

  public warn(message: string, context: string, cause?: unknown): void {
    this.logging.warn(cause ?? message, context);
    this.messageService.add({
      severity: 'warn',
      summary: this.translation.translate('logging.warn'),
      detail: message,
      life: 5000
    });
  }

  /**
   * A warning offering a one-click follow-up. It never auto-dismisses: an offer
   * that expires before the user reads it is worse than one they close.
   */
  public warnWithAction(
    message: string,
    context: string,
    action: ToastAction
  ): void {
    this.logging.warn(message, context);
    this.messageService.add({
      severity: 'warn',
      summary: this.translation.translate('logging.warn'),
      detail: message,
      life: 0,
      action
    });
  }

  public success(message: string, context: string): void {
    this.logging.info(message, context);
    this.messageService.add({
      severity: 'success',
      summary: this.translation.translate('logging.success'),
      detail: message,
      life: 5000
    });
  }

  public info(message: string, context: string): void {
    this.logging.info(message, context);
    this.messageService.add({
      severity: 'info',
      summary: this.translation.translate('logging.info'),
      detail: message,
      life: 5000
    });
  }
}

/**
 * Renders a cause for {@link AnalyticsEvent.ErrorShown}: the error's identity,
 * never its stack, which belongs to `$exception`. An object of unknown shape
 * becomes its class name — mangled in production, so pass a string or an
 * `Error` for a readable cause.
 */
function formatCause(cause: unknown): string | undefined {
  if (cause === undefined) return undefined;
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  if (typeof cause === 'string') return cause;
  if (typeof cause !== 'object') return typeof cause;
  // Deliberately no `String(cause)`: it throws on a null prototype and dumps
  // a function's source. This runs outside `AnalyticsService.capture`'s guard,
  // so it must be total.
  return cause?.constructor?.name ?? 'object';
}
