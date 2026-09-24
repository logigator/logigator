import { inject, Injectable } from '@angular/core';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';
import { TranslationService } from '../translation/translation.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { detectBrowserSupport } from './browser-support';

/**
 * Notifies the user once per session when their browser falls outside the
 * supported range.
 *
 * The notice is a dismissible warning rather than a block: an out-of-range
 * browser usually runs the editor, and the range is a tested-against list, not
 * a capability probe. It reads as a heads-up for that reason.
 */
@Injectable({ providedIn: 'root' })
export class BrowserSupportService {
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);
  private readonly translation = inject(TranslationService);
  private readonly analytics = inject(AnalyticsService);

  public warnIfUnsupported(userAgent: string = navigator.userAgent): void {
    const verdict = detectBrowserSupport(userAgent);
    // Logged for every verdict, a supported one included: what the parser made
    // of a user agent is the thing worth seeing when a report blames the
    // browser. The toast below mirrors its own message at warn level.
    this.logging.debug(
      `${verdict.family} ${verdict.major}.${verdict.minor} — ${verdict.reason ?? 'supported'}`,
      'BrowserSupportService'
    );
    if (verdict.supported) return;

    this.toast.warn(
      this.translation.translate('browserSupport.unsupported'),
      'BrowserSupportService'
    );
    // Deferred: the notice shows during startup, long before a consent answer
    // and the PostHog import can have landed.
    this.analytics.captureWhenReady(AnalyticsEvent.BrowserUnsupported, {
      family: verdict.family,
      major: verdict.major,
      minor: verdict.minor,
      reason: verdict.reason
    });
  }
}
