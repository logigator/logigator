import { inject, Injectable } from '@angular/core';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/**
 * Where the previous editor is served. Root-relative on purpose: this app's
 * `baseHref` is `/editor/`, so a relative path would resolve inside it, and the
 * SPA has no access to the backend's `domains.json`. Caddy routes the path to
 * the legacy container — under a bare `ng serve` (no proxy) it 404s.
 */
export const LEGACY_EDITOR_URL = '/legacy-editor';

/** Which surface handed the user off, the breakdown axis on the event. */
export type LegacyEditorSource = 'menu' | 'bug-report';

/**
 * The single way the app sends a user to the previous editor. Every hand-off
 * goes through {@link open} so the departure is always reported as
 * `legacy_editor_opened` — a surface that links to {@link LEGACY_EDITOR_URL}
 * itself would leave the app silently, and a user leaving because something is
 * broken here is exactly what the event exists to measure. Consumers therefore
 * render a control, never an `<a href>`.
 */
@Injectable({ providedIn: 'root' })
export class LegacyEditorService {
  private readonly analytics = inject(AnalyticsService);

  /**
   * Reports the hand-off and opens the legacy editor in a new tab, leaving
   * anything unsaved alive in this one. Capturing first: the new tab is a
   * separate document, so this one keeps running and delivers the request, but
   * the order removes the question.
   */
  public open(source: LegacyEditorSource): void {
    this.analytics.capture(AnalyticsEvent.LegacyEditorOpened, { source });
    window.open(LEGACY_EDITOR_URL, '_blank', 'noopener');
  }
}
