import { inject, Injectable } from '@angular/core';
import { ToastService as UiToastService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
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

  public error(message: string, context: string, cause?: unknown): void {
    this.logging.error(cause ?? message, context);
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
