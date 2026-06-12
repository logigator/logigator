import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslocoService } from '@jsverse/transloco';

/**
 * UI-facing service that shows translated PrimeNG toast notifications.
 * Inject this where the user needs to see feedback; inject
 * {@link LoggingService} directly where console output is needed.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly messageService = inject(MessageService);
  private readonly translocoService = inject(TranslocoService);

  public error(message: string): void {
    this.messageService.add({
      severity: 'danger',
      summary: this.translocoService.translate('logging.error'),
      detail: message,
      life: 8000
    });
  }

  public warn(message: string): void {
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
