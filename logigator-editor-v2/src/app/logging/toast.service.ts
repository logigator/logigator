import { inject, Injectable } from '@angular/core';
import { ToastService as UiToastService } from '@logigator/ui';
import { TranslocoService } from '@jsverse/transloco';
import { LoggingService } from './logging.service';

/**
 * UI-facing service that shows translated toast notifications.
 *
 * Every toast also mirrors to {@link LoggingService} so each message surfaced
 * to the user leaves a console trail. The mandatory `context` (the originating
 * class name) is what identifies the origin, since bundling obscures the
 * native call site. `error`/`warn` take an optional trailing `cause` — pass the
 * underlying error there for richer developer detail; it is logged in place of
 * the user-facing message. `error`/`warn` log at their level; `success`/`info`
 * log at info level (suppressed by a production `loggingVerbosity` of `Warn`).
 *
 * Inject this where the user needs to see feedback; inject
 * {@link LoggingService} directly where only console output is needed.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly messageService = inject(UiToastService);
  private readonly translocoService = inject(TranslocoService);
  private readonly logging = inject(LoggingService);

  public error(message: string, context: string, cause?: unknown): void {
    this.logging.error(cause ?? message, context);
    this.messageService.add({
      severity: 'danger',
      summary: this.translocoService.translate('logging.error'),
      detail: message,
      life: 8000
    });
  }

  public warn(message: string, context: string, cause?: unknown): void {
    this.logging.warn(cause ?? message, context);
    this.messageService.add({
      severity: 'warn',
      summary: this.translocoService.translate('logging.warn'),
      detail: message,
      life: 5000
    });
  }

  public success(message: string, context: string): void {
    this.logging.info(message, context);
    this.messageService.add({
      severity: 'success',
      summary: this.translocoService.translate('logging.success'),
      detail: message,
      life: 5000
    });
  }

  public info(message: string, context: string): void {
    this.logging.info(message, context);
    this.messageService.add({
      severity: 'info',
      summary: this.translocoService.translate('logging.info'),
      detail: message,
      life: 5000
    });
  }
}
