import { Component, computed, input } from '@angular/core';
import { LgBadge } from '@logigator/ui';

/**
 * Cloud/local provenance indicator for a custom component, in two variants:
 *
 * - `chip` (default) — a solid {@link LgBadge} pill with an icon + "Cloud"/"Local"
 *   label. Being a filled badge it stays legible on any surface.
 * - `badge` — a small corner glyph, overlaid on a palette tile (the tile is the
 *   positioned ancestor; the host is `display: contents` so the absolute badge
 *   anchors to the tile exactly as the inline markup did). Too small for a full
 *   `LgBadge`, so it stays a bespoke dot.
 *
 * Owns the icon, colour and tooltip wording so every call site stays in sync.
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
        @if (isServer()) {
          <i class="ph ph-cloud text-sky-400 text-[0.6rem]"></i>
        } @else {
          <i class="ph ph-browser text-muted text-[0.6rem]"></i>
        }
      </span>
    } @else {
      <lg-badge
        rounded
        [severity]="isServer() ? 'info' : 'secondary'"
        [title]="title()"
      >
        <i [class]="isServer() ? 'ph ph-cloud' : 'ph ph-browser'"></i>
        {{ isServer() ? 'Cloud' : 'Local' }}
      </lg-badge>
    }`
})
export class SourceIndicatorComponent {
  /** Which library the component/project lives in. */
  public readonly source = input.required<'server' | 'browser'>();
  /** Visual form: a labelled `LgBadge` pill (`chip`) or a tile corner glyph (`badge`). */
  public readonly variant = input<'chip' | 'badge'>('chip');

  protected readonly isServer = computed(() => this.source() === 'server');
  protected readonly title = computed(() =>
    this.isServer()
      ? 'Saved in your cloud library'
      : 'Saved in this browser only'
  );
}
