import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { pictureFor } from '@logigator/ui';
// Aliased: the component below is what a page names, and the two would
// otherwise collide in this file.
import type { CircuitPreview as PreviewSources } from '@logigator/contract';
import { ThemingService } from '../theming/theming.service';

/**
 * A circuit's saved render, framed. Wherever a preview appears outside a tile —
 * an examples row, a document's own page — this is it.
 *
 * The theme is picked here rather than by the markup: both themes are separate
 * renders and no `<picture>` can negotiate a colour scheme, so hiding one with
 * CSS would download both. Square, because the render is: `PREVIEW_VARIANTS` is
 * 256 and 1024, and a wider frame only bands or crops it.
 *
 * A circuit that has never been saved from the editor has no render at all, and
 * the empty frame is the editor's own empty board.
 */
@Component({
  selector: 'web-circuit-preview',
  host: { class: 'block' },
  template: `
    <span
      class="block aspect-square w-full rounded-md border border-border bg-surface-100 p-3 dark:bg-surface-800"
      [class.lattice]="!picture()"
    >
      @if (picture(); as p) {
        <!-- display:contents so the <img> sizes against the padded box. -->
        <picture class="contents">
          @for (group of p.groups; track group.type) {
            <source
              [srcset]="group.srcset"
              [sizes]="sizes()"
              [attr.type]="group.type"
            />
          }
          <img
            alt=""
            class="h-full w-full object-contain"
            [src]="p.src"
            [attr.srcset]="p.srcset"
            [attr.sizes]="p.srcset ? sizes() : null"
            [attr.loading]="loading()"
          />
        </picture>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitPreview {
  private readonly theming = inject(ThemingService);

  readonly preview = input.required<PreviewSources | null>();

  /** What the frame measures at each width, for the browser to pick a rung. */
  readonly sizes = input('100vw');

  /** `eager` for a frame above the fold; everything else waits. */
  readonly loading = input<'lazy' | 'eager'>('lazy');

  protected readonly picture = computed(() => {
    const preview = this.preview();
    if (!preview) return undefined;
    return pictureFor(this.theming.isDark() ? preview.dark : preview.light);
  });
}
