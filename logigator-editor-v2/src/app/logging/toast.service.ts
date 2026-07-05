import { inject, Injectable } from '@angular/core';
import { ToastService as UiToastService } from '@logigator/ui';
import { TranslocoService } from '@jsverse/transloco';
import { LoggingService } from './logging.service';

/**
 * UI-facing service that shows translated toast notifications.
 *
 * `error` and `warn` additionally mirror to {@link LoggingService} so every
 * problem surfaced to the user leaves a console trail with richer developer
 * detail: pass the underlying error/cause as the second argument and the
 * originating class name as the third. `success`/`info` stay toast-only.
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

  public error(message: string, cause?: unknown, context = 'App'): void {
    this.logging.error(cause ?? message, context);
    this.messageService.add({
      severity: 'danger',
      summary: this.translocoService.translate('logging.error'),
      detail: message,
      life: 8000
    });
  }

  public warn(message: string, cause?: unknown, context = 'App'): void {
    this.logging.warn(cause ?? message, context);
    this.messageService.add({
      severity: 'warn',
      summary: this.translocoService.translate('logging.warn'),
      detail: message,
      life: 5000
    });
  }

  public success(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translocoService.translate('logging.success'),
      detail: message,
      life: 5000
    });
  }

  public info(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: this.translocoService.translate('logging.info'),
      detail: message,
      life: 5000
    });
  }
}
