import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

/**
 * Cloud/local provenance indicator for a custom component, in two variants:
 *
 * - `chip` (default) — a pill with an icon + "Cloud"/"Local" label, shown in the
 *   component-settings header.
 * - `badge` — a small corner glyph, overlaid on a palette tile (the tile is the
 *   positioned ancestor; the host is `display: contents` so the absolute badge
 *   anchors to the tile exactly as the inline markup did).
 *
 * Owns the icon, colour and tooltip wording so both call sites stay in sync.
 */
@Component({
  selector: 'app-source-indicator',
  host: { class: 'contents' },
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
      <span
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-normal border"
        [class]="
          isServer()
            ? 'text-sky-400 border-sky-400/40'
            : 'text-muted border-border'
        "
        [title]="title()"
      >
        <i [class]="isServer() ? 'ph ph-cloud' : 'ph ph-browser'"></i>
        {{ isServer() ? 'Cloud' : 'Local' }}
      </span>
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SourceIndicatorComponent {
  /** Which library the component lives in. */
  public readonly source = input.required<'server' | 'browser'>();
  /** Visual form: a labelled pill (`chip`) or a tile corner glyph (`badge`). */
  public readonly variant = input<'chip' | 'badge'>('chip');

  protected readonly isServer = computed(() => this.source() === 'server');
  protected readonly title = computed(() =>
    this.isServer()
      ? 'Saved in your cloud library'
      : 'Saved in this browser only'
  );
}
