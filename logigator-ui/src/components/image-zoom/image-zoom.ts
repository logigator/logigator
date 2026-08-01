import { Component, inject, input } from '@angular/core';
import { ImageZoomViewer } from './image-zoom-viewer';

/**
 * An image that opens full-size in a modal overlay when clicked — for content
 * shown small in the flow of a page that the reader still needs to be able to
 * look at properly. The consumer sizes the host; the image fills it.
 *
 * Rendered as a real button wrapping the image, so focus and keyboard
 * activation come native; the button's accessible name is the image's `alt`,
 * which is therefore required — without it the button would be unnamed.
 * Images inside rendered markdown can't host a component — `LgMarkdown` builds
 * the same zoom in instead.
 *
 * Dismiss is Escape, the backdrop, or a click on the enlarged image.
 */
@Component({
  selector: 'lg-image-zoom',
  providers: [ImageZoomViewer],
  host: { class: 'inline-block' },
  template: `
    <button type="button" class="block cursor-zoom-in" (click)="open()">
      <img [src]="src()" [alt]="alt()" class="block max-w-full" />
    </button>
  `
})
export class LgImageZoom {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();

  private readonly viewer = inject(ImageZoomViewer);

  protected open(): void {
    this.viewer.open(this.src(), this.alt());
  }
}
