import { Component, inject, InjectionToken } from '@angular/core';
import { LgScaleIn } from '../../internal/fade-in';

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
 * Internal. The panel {@link ImageZoomViewer} attaches to its modal overlay. A
 * button wraps the image, so the focus trap has something to focus, the
 * keyboard can dismiss it, and a click anywhere on it closes.
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
