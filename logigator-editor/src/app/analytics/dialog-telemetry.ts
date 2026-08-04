import { inject } from '@angular/core';
import { LgDialogTelemetry, provideLgDialogTelemetry } from '@logigator/ui';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './analytics.mapping';

/**
 * Bridges the library's dialog lifecycle hook to the analytics sink, so every
 * dialog carrying a `telemetryId` reports its open and its close without the
 * call site subscribing to anything. `AnalyticsService.capture` drops events
 * until consent, so this stays inert until then like every other source.
 *
 * `resolved` mirrors the library's meaning exactly — the dialog closed with a
 * result — and is not a completion signal; see `DialogId`.
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
