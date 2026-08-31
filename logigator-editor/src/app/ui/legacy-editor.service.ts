import { inject, Injectable } from '@angular/core';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/**
 * Where the previous editor is served. Root-relative on purpose: this app's
 * `baseHref` is `/editor/`, so a relative path would resolve inside it. Caddy
 * routes the path to the legacy container; under a bare `ng serve` it 404s.
 */
export const LEGACY_EDITOR_URL = '/legacy-editor';

/** Which surface handed the user off; the event's breakdown axis. */
export type LegacyEditorSource = 'menu' | 'bug-report';

/**
 * The single way the app sends a user to the previous editor, so the departure
 * is always reported: a surface linking to {@link LEGACY_EDITOR_URL} itself
 * would leave silently, and a user leaving because something here is broken is
 * what the event measures. Consumers render a control, never an `<a href>`.
 */
@Injectable({ providedIn: 'root' })
export class LegacyEditorService {
  private readonly analytics = inject(AnalyticsService);

  /**
   * Reports the hand-off and opens the legacy editor in a new tab, leaving
   * anything unsaved alive in this one. Captures first so the order leaves no
   * question, though a new tab is a separate document either way.
   */
  public open(source: LegacyEditorSource): void {
    this.analytics.capture(AnalyticsEvent.LegacyEditorOpened, { source });
    window.open(LEGACY_EDITOR_URL, '_blank', 'noopener');
  }
}
