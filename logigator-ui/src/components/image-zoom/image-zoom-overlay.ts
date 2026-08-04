import { Component, inject, InjectionToken } from '@angular/core';
import { LgScaleIn } from '../../internal/fade-in';

/** The image an {@link LgImageZoomOverlay} shows, and how it closes. */
export interface ImageZoomData {
  src: string;
  alt: string;
  /** ARIA label for the dismiss button; ImageZoomViewer always supplies it. */
  closeLabel: string;
  close: () => void;
}

export const IMAGE_ZOOM_DATA = new InjectionToken<ImageZoomData>(
  'lg-image-zoom-data'
);

/**
 * The enlarged image itself — the panel `ImageZoomViewer` attaches to its
 * modal overlay. The image is wrapped in a button so the focus trap has
 * something to focus and the keyboard can dismiss it, and so a click anywhere
 * on the image closes (matching the backdrop).
 *
 * Internal — reached through {@link ImageZoomViewer}.
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
      <img
        lgScaleIn
        [src]="data.src"
        [alt]="data.alt"
        class="max-h-[92vh] max-w-[92vw] rounded-lg shadow-xl"
      />
    </button>
  `
})
export class LgImageZoomOverlay {
  protected readonly data = inject(IMAGE_ZOOM_DATA);
}
