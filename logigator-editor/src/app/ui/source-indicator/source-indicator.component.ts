import { Component, computed, input } from '@angular/core';
import { LgBadge, LgSeverity } from '@logigator/ui';
import { TranslateDirective } from '../../translation/translate.directive';

/** Where the shown circuit lives, or its persistence state. */
export type SourceIndicatorState =
  'server' | 'browser' | 'draft' | 'share' | 'embedded';

interface StateStyle {
  icon: string;
  /** Badge colour role, chip variant. */
  severity: LgSeverity;
  /** Icon colour class, badge variant. */
  glyph: string;
}

/**
 * Provenance indicator for a custom component or project, in two variants:
 *
 * - `chip` (default) — a filled {@link LgBadge} pill, legible on any surface.
 * - `badge` — a bespoke corner glyph on a palette tile, too small for
 *   `LgBadge`. The host is `display: contents` so the absolute badge anchors
 *   to the tile.
 *
 * The states are `server` (cloud), `browser` (saved locally), `draft` (never
 * saved), `share` (read-only from a share link) and `embedded` (a placed custom
 * whose library master is gone, so the circuit survives only as the embedded
 * copy). Each tooltip defaults to a translated string hosts can override.
 */
@Component({
  selector: 'app-source-indicator',
  host: { class: 'contents' },
  imports: [LgBadge, TranslateDirective],
  template: `<ng-container *appTranslate="let t">
    @if (variant() === 'badge') {
      <span
        class="absolute -top-1.5 -left-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-content border border-border"
        [title]="titleOverride() || t(titleKey())"
      >
        <i [class]="style().icon + ' ' + style().glyph + ' text-[0.6rem]'"></i>
      </span>
    } @else {
      <lg-badge
        rounded
        [severity]="style().severity"
        [title]="titleOverride() || t(titleKey())"
      >
        <i [class]="style().icon"></i>
        {{ t(labelKey()) }}
      </lg-badge>
    }
  </ng-container>`
})
export class SourceIndicatorComponent {
  public readonly source = input.required<SourceIndicatorState>();
  public readonly variant = input<'chip' | 'badge'>('chip');

  /**
   * Per-state tooltip overrides. Empty falls back to the translated default
   * `sourceIndicator.title.<state>`.
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
      glyph: 'text-warn-text'
    },
    share: {
      icon: 'ph ph-share-network',
      severity: 'success',
      glyph: 'text-emerald-400'
    },
    embedded: {
      icon: 'ph ph-package',
      severity: 'warn',
      glyph: 'text-warn-text'
    }
  };

  protected readonly style = computed(
    () => SourceIndicatorComponent.STYLES[this.source()]
  );

  // Built here rather than in the template: `as const` keeps the template
  // literal a literal type, so these state-keyed keys are checked against the
  // translation schema like any hand-written key.
  protected readonly titleKey = computed(
    () => `sourceIndicator.title.${this.source()}` as const
  );
  protected readonly labelKey = computed(
    () => `sourceIndicator.label.${this.source()}` as const
  );

  /** The host-supplied tooltip for the current state, `''` for the default. */
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
