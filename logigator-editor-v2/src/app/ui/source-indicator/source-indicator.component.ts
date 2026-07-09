import { Component, computed, input } from '@angular/core';
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
  label: string;
}

/**
 * Provenance / persistence indicator for a custom component or project, in two
 * variants:
 *
 * - `chip` (default) — a solid {@link LgBadge} pill with an icon + label. Being a
 *   filled badge it stays legible on any surface, including the coloured title bar.
 * - `badge` — a small corner glyph, overlaid on a palette tile (the tile is the
 *   positioned ancestor; the host is `display: contents` so the absolute badge
 *   anchors to the tile exactly as the inline markup did). Too small for a full
 *   `LgBadge`, so it stays a bespoke dot.
 *
 * Five states: `server` (cloud), `browser` (saved locally), `draft` (never saved
 * yet), `share` (opened read-only from a share link) and `embedded` (a placed
 * custom whose library master is gone — its circuit survives only as the embedded
 * copy). Owns the icon, colour and label per state so every call site stays in
 * sync; tooltips are overridable (defaults suit a component) so hosts can
 * localize them.
 */
@Component({
  selector: 'app-source-indicator',
  host: { class: 'contents' },
  imports: [LgBadge],
  template: `@if (variant() === 'badge') {
      <span
        class="absolute -top-1.5 -left-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-content border border-border"
        [title]="title()"
      >
        <i [class]="style().icon + ' ' + style().glyph + ' text-[0.6rem]'"></i>
      </span>
    } @else {
      <lg-badge rounded [severity]="style().severity" [title]="title()">
        <i [class]="style().icon"></i>
        {{ style().label }}
      </lg-badge>
    }`
})
export class SourceIndicatorComponent {
  /** Which library the component/project lives in, or its unsaved/shared state. */
  public readonly source = input.required<SourceIndicatorState>();
  /** Visual form: a labelled `LgBadge` pill (`chip`) or a tile corner glyph (`badge`). */
  public readonly variant = input<'chip' | 'badge'>('chip');

  /** Per-state tooltip overrides (defaults suit a component). */
  public readonly serverTitle = input<string>('Saved in your cloud library');
  public readonly browserTitle = input<string>('Saved in this browser only');
  public readonly draftTitle = input<string>('Not saved yet');
  public readonly shareTitle = input<string>('Opened from a share link');
  public readonly embeddedTitle = input<string>(
    'Embedded copy — its library component is no longer available'
  );

  private static readonly STYLES: Record<SourceIndicatorState, StateStyle> = {
    server: {
      icon: 'ph ph-cloud',
      severity: 'info',
      glyph: 'text-sky-400',
      label: 'Cloud'
    },
    browser: {
      icon: 'ph ph-browser',
      severity: 'secondary',
      glyph: 'text-muted',
      label: 'Local'
    },
    draft: {
      icon: 'ph ph-pencil-simple-line',
      severity: 'warn',
      glyph: 'text-warn',
      label: 'Draft'
    },
    share: {
      icon: 'ph ph-share-network',
      severity: 'success',
      glyph: 'text-emerald-400',
      label: 'Shared'
    },
    embedded: {
      icon: 'ph ph-package',
      severity: 'warn',
      glyph: 'text-warn',
      label: 'Embedded'
    }
  };

  protected readonly style = computed(
    () => SourceIndicatorComponent.STYLES[this.source()]
  );

  protected readonly title = computed(() => {
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
