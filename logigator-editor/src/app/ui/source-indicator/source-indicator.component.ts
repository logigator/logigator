import { Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LgBadge, LgSeverity } from '@logigator/ui';

/** Where the shown circuit lives / its persistence state. */
export type SourceIndicatorState =
  | 'server'
  | 'browser'
  | 'draft'
  | 'share'
  | 'embedded';

interface StateStyle {
  icon: string;
  /** Badge colour role (chip variant). */
  severity: LgSeverity;
  /** Icon colour class for the compact corner glyph (badge variant). */
  glyph: string;
}

/**
 * Provenance / persistence indicator for a custom component or project, in two
 * variants:
 *
 * - `chip` (default) — a filled {@link LgBadge} pill (icon + label), legible on
 *   any surface, including the coloured title bar.
 * - `badge` — a small corner glyph on a palette tile (host is `display: contents`
 *   so the absolute badge anchors to the tile); a bespoke dot, too small for
 *   `LgBadge`.
 *
 * Five states: `server` (cloud), `browser` (saved locally), `draft` (never saved
 * yet), `share` (read-only from a share link), `embedded` (placed custom whose
 * library master is gone — circuit survives only as the embedded copy). Owns the
 * icon and colour per state; labels are translated per state, and each tooltip
 * defaults to a translated component-context string that hosts can override.
 */
@Component({
  selector: 'app-source-indicator',
  host: { class: 'contents' },
  imports: [LgBadge, TranslocoDirective],
  template: `<ng-container *transloco="let t">
    @if (variant() === 'badge') {
      <span
        class="absolute -top-1.5 -left-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-content border border-border"
        [title]="titleOverride() || t('sourceIndicator.title.' + source())"
      >
        <i [class]="style().icon + ' ' + style().glyph + ' text-[0.6rem]'"></i>
      </span>
    } @else {
      <lg-badge
        rounded
        [severity]="style().severity"
        [title]="titleOverride() || t('sourceIndicator.title.' + source())"
      >
        <i [class]="style().icon"></i>
        {{ t('sourceIndicator.label.' + source()) }}
      </lg-badge>
    }
  </ng-container>`
})
export class SourceIndicatorComponent {
  /** Which library the component/project lives in, or its unsaved/shared state. */
  public readonly source = input.required<SourceIndicatorState>();
  /** Visual form: a labelled `LgBadge` pill (`chip`) or a tile corner glyph (`badge`). */
  public readonly variant = input<'chip' | 'badge'>('chip');

  /**
   * Per-state tooltip overrides. Empty falls back to the translated
   * component-context default (`sourceIndicator.title.<state>`); hosts pass a
   * context-specific string (e.g. project wording in the title bar).
   */
  public readonly serverTitle = input<string>('');
  public readonly browserTitle = input<string>('');
  public readonly draftTitle = input<string>('');
  public readonly shareTitle = input<string>('');
  public readonly embeddedTitle = input<string>('');

  private static readonly STYLES: Record<SourceIndicatorState, StateStyle> = {
    server: {
      icon: 'ph ph-cloud',
      severity: 'info',
      glyph: 'text-sky-400'
    },
    browser: {
      icon: 'ph ph-browser',
      severity: 'secondary',
      glyph: 'text-muted'
    },
    draft: {
      icon: 'ph ph-pencil-simple-line',
      severity: 'warn',
      glyph: 'text-warn'
    },
    share: {
      icon: 'ph ph-share-network',
      severity: 'success',
      glyph: 'text-emerald-400'
    },
    embedded: {
      icon: 'ph ph-package',
      severity: 'warn',
      glyph: 'text-warn'
    }
  };

  protected readonly style = computed(
    () => SourceIndicatorComponent.STYLES[this.source()]
  );

  /** The host-supplied tooltip for the current state, or `''` for the default. */
  protected readonly titleOverride = computed(() => {
    switch (this.source()) {
      case 'server':
        return this.serverTitle();
      case 'browser':
        return this.browserTitle();
      case 'draft':
        return this.draftTitle();
      case 'share':
        return this.shareTitle();
      case 'embedded':
        return this.embeddedTitle();
    }
  });
}
