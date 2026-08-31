import { inject, Injectable } from '@angular/core';
import { ToastAction, ToastService as UiToastService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { LoggingService } from './logging.service';

/**
 * UI-facing service for translated toast notifications.
 *
 * Every toast mirrors to {@link LoggingService}, so each user-facing message
 * leaves a console trail; the mandatory `context` (originating class name)
 * identifies the origin, since bundling obscures the native call site.
 * `error`/`warn` take an optional trailing `cause` — the underlying error,
 * logged in place of the user-facing message. `error`/`warn` log at their own
 * level; `success`/`info` log at info (suppressed by a production
 * `loggingVerbosity` of `Warn`).
 *
 * Error toasts additionally emit {@link AnalyticsEvent.ErrorShown}, so failures
 * the app *handles* — which never reach the {@link GlobalErrorHandler} and thus
 * never become a PostHog `$exception` — are still visible in analytics. The
 * `context`, the shown message and the cause's identity travel, each truncated
 * by the sanitizer. They are the one place free-form text — toast details
 * interpolate project and component names, file names, diagnostic text —
 * reaches analytics.
 *
 * Inject this where the user needs feedback; inject {@link LoggingService}
 * directly for console-only output.
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
   * A warning that offers a one-click follow-up. It never auto-dismisses: an
   * offer that expires before the user reads it is worse than one they close.
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
 * never its stack — stacks belong to `$exception`, and an object of unknown
 * shape becomes its class name rather than its contents (a name the production
 * bundler mangles, so that branch says little beyond "some object"; call sites
 * wanting a readable cause pass a string or an `Error`). `undefined` is dropped
 * by the sanitizer, so a cause-less toast simply omits the property.
 */
function formatCause(cause: unknown): string | undefined {
  if (cause === undefined) return undefined;
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  if (typeof cause === 'string') return cause;
  if (typeof cause !== 'object') return typeof cause;
  // Deliberately no `String(cause)`: it throws on a null prototype and dumps a
  // function's source. This runs on the error path and outside the guard in
  // `AnalyticsService.capture`, so it must be total.
  return cause?.constructor?.name ?? 'object';
}
