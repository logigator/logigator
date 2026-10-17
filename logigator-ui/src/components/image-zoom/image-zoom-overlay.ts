import { Component, inject, InjectionToken } from '@angular/core';
import { LgScaleIn } from '../../internal/fade-in';
import { LgPicture } from '../../internal/picture';

export interface ImageZoomData {
  picture: LgPicture;
  /**
   * The widest rung's width, for a ladder; `null` for one URL, which an
   * `<img>` already shows at its natural size.
   */
  width: number | null;
  alt: string;
  /** Draw the dot ground under the image; see ImageZoomOptions. */
  transparent: boolean;
  /** ARIA label for the dismiss button; ImageZoomViewer always supplies it. */
  closeLabel: string;
  close: () => void;
}

export const IMAGE_ZOOM_DATA = new InjectionToken<ImageZoomData>(
  'lg-image-zoom-data'
);

/** The share of the viewport the enlarged image may take, either way. */
const VIEWPORT_SHARE = 0.92;

/**
 * What the enlarged image measures, for the browser to pick a rung — and, a
 * `sizes` being the intrinsic width a `srcset` image lays out at, what keeps
 * it from going past 100%: the overlay's width, up to the widest rung's. Erring
 * wide below that only fetches a sharper rung. A media condition rather than
 * `min()`, which not every browser reads in `sizes`.
 */
function zoomSizes(width: number): string {
  const breakpoint = Math.ceil(width / VIEWPORT_SHARE);
  return `(max-width: ${breakpoint}px) ${VIEWPORT_SHARE * 100}vw, ${width}px`;
}

/**
 * Internal. The panel {@link ImageZoomViewer} attaches to its modal overlay. A
 * button wraps the image, so the focus trap has something to focus, the
 * keyboard can dismiss it, and a click anywhere on it closes.
 *
 * The ground is drawn on the `<img>` itself — padding, border and background —
 * rather than on a wrapper, so the overlay's size limits apply to the frame
 * and the image together and the frame always hugs the image.
 */
@Component({
  selector: 'lg-image-zoom-overlay',
  imports: [LgScaleIn],
  template: `
    <button
      type="button"
      [attr.aria-label]="data.closeLabel"
      class="block cursor-zoom-out"
      (click)="data.close()"
    >
      <!-- display:contents so the <img> sizes against the overlay. -->
      <picture class="contents">
        @for (group of data.picture.groups; track group.type) {
          <source
            [srcset]="group.srcset"
            [attr.sizes]="sizes"
            [attr.type]="group.type"
          />
        }
        <img
          lgScaleIn
          [src]="data.picture.src"
          [attr.srcset]="data.picture.srcset"
          [attr.sizes]="data.picture.srcset ? sizes : null"
          [alt]="data.alt"
          class="max-h-[92vh] max-w-[92vw] rounded-lg shadow-xl"
          [class]="data.transparent ? GROUND_CLASSES : ''"
        />
      </picture>
    </button>
  `
})
export class LgImageZoomOverlay {
  protected readonly data = inject(IMAGE_ZOOM_DATA);

  protected readonly sizes =
    this.data.width === null ? null : zoomSizes(this.data.width);

  /** The circuit tile's frame, at the size of the overlay. */
  protected readonly GROUND_CLASSES =
    'lattice border border-border bg-surface-100 p-6 dark:bg-surface-800';
}
