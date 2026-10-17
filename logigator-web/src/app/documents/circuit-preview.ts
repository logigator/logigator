import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import {
  ImageZoomViewer,
  LgPreviewPlaceholder,
  pictureFor
} from '@logigator/ui';
// Aliased: the component below is what a page names, and the two would
// otherwise collide in this file.
import type { CircuitPreview as PreviewSources } from '@logigator/contract';
import { ThemingService } from '../theming/theming.service';
import { TranslationService } from '../translation/translation.service';

/**
 * A circuit's saved render, framed. Wherever a preview appears outside a tile —
 * an examples row, a document's own page — this is it.
 *
 * The theme is picked here rather than by the markup: both themes are separate
 * renders and no `<picture>` can negotiate a colour scheme, so hiding one with
 * CSS would download both. Square, because the render is: `PREVIEW_VARIANTS` is
 * 256 and 1024, and a wider frame only bands or crops it.
 *
 * The frame carries the editor's dot ground under whatever it draws: a render
 * is line art on transparency, so the ground is what makes it the board it was
 * taken from. A circuit that has never been saved from the editor has no render
 * at all, and the frame then draws {@link LgPreviewPlaceholder} on that ground
 * — an image glyph — so a missing render is never silent.
 *
 * A render opens full-size on a click, the way a documentation screenshot
 * does: the frame is the button, and the viewer is handed the whole ladder, so
 * the enlarged board is the widest rung rather than the one the frame drew.
 */
@Component({
  selector: 'web-circuit-preview',
  imports: [LgPreviewPlaceholder],
  host: { class: 'block' },
  providers: [ImageZoomViewer],
  template: `
    @if (picture(); as p) {
      <button
        type="button"
        class="cursor-zoom-in transition-colors hover:border-primary"
        [class]="FRAME_CLASSES"
        [attr.aria-label]="enlargeLabel()"
        (click)="enlarge()"
      >
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
      </button>
    } @else {
      <span [class]="FRAME_CLASSES">
        <lg-preview-placeholder />
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitPreview {
  private readonly theming = inject(ThemingService);
  private readonly translation = inject(TranslationService);
  private readonly zoom = inject(ImageZoomViewer);

  readonly preview = input.required<PreviewSources | null>();

  /** The circuit's name: what the enlarge button and the enlarged render say. */
  readonly name = input.required<string>();

  /** What the frame measures at each width, for the browser to pick a rung. */
  readonly sizes = input('100vw');

  /** `eager` for a frame above the fold; everything else waits. */
  readonly loading = input<'lazy' | 'eager'>('lazy');

  /** The active theme's ladder; the frame draws it, the zoom takes it whole. */
  private readonly ladder = computed(() => {
    const preview = this.preview();
    if (!preview) return undefined;
    return this.theming.isDark() ? preview.dark : preview.light;
  });

  protected readonly picture = computed(() => pictureFor(this.ladder()));

  protected readonly enlargeLabel = computed(() =>
    this.translation.translate('documents.enlargePreview', {
      name: this.name()
    })
  );

  protected readonly FRAME_CLASSES =
    'lattice block aspect-square w-full rounded-md border border-border bg-surface-100 p-3 dark:bg-surface-800';

  protected enlarge(): void {
    const ladder = this.ladder();
    if (ladder) this.zoom.open(ladder, this.name(), { transparent: true });
  }
}
