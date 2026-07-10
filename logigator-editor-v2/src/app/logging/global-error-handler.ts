import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LoggingService } from './logging.service';
import { ToastService } from './toast.service';

/**
 * Catches every otherwise-uncaught exception and unhandled promise rejection.
 *
 * The full error is logged on *every* occurrence (the console dedupes visually).
 * The user-facing toast is throttled: an uncaught error inside the PixiJS render
 * loop / change detection can recur every frame, so toasting unconditionally
 * would machine-gun the UI. Services are resolved lazily through the injector to
 * avoid a bootstrap DI cycle (this handler is constructed very early), and the
 * toast path is guarded so a failure while reporting can never re-enter here.
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

    const now = performance.now();
    if (now - this.lastToastAt < GlobalErrorHandler.TOAST_COOLDOWN_MS) return;
    this.lastToastAt = now;

    try {
      const toast = this.injector.get(ToastService, null);
      const transloco = this.injector.get(TranslocoService, null);
      const message =
        transloco?.translate('logging.unexpectedError') ??
        'Something went wrong.';
      // Full error already logged above; this only shows the throttled generic
      // toast (its own mirror re-logs the short message harmlessly).
      toast?.error(message, 'GlobalErrorHandler');
    } catch {
      // Never let error reporting throw and re-enter the handler.
    }
  }
}
