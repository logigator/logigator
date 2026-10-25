import { inject } from '@angular/core';
import { LgDialogTelemetry, provideLgDialogTelemetry } from '@logigator/ui';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './analytics.mapping';

/**
 * Bridges the library's dialog lifecycle hook to the analytics sink, so every
 * dialog carrying a `telemetryId` reports open and close without its call site
 * subscribing to anything.
 *
 * `resolved` means the dialog closed with a result, not that the task
 * completed; see `DialogId`.
 */
export function provideDialogAnalytics(): ReturnType<
  typeof provideLgDialogTelemetry
> {
  return provideLgDialogTelemetry((): LgDialogTelemetry => {
    const analytics = inject(AnalyticsService);
    return {
      onOpen: (dialog) =>
        analytics.capture(AnalyticsEvent.DialogOpened, { dialog }),
      onClose: (dialog, resolved) =>
        analytics.capture(AnalyticsEvent.DialogClosed, { dialog, resolved })
    };
  });
}
