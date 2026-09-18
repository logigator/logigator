import { Component, inject, input } from '@angular/core';
import { ImageZoomViewer } from './image-zoom-viewer';
import { lgLabel } from '../../tokens/labels';

/**
 * An image that opens full-size in a modal overlay when clicked, dismissed by
 * Escape, the backdrop, or a click on it. The consumer sizes the host and the
 * image fills it.
 *
 * A real button wraps the image, so focus and keyboard activation are native;
 * `alt` is required because it is that button's accessible name.
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
  readonly closeLabel = input(lgLabel('close'));

  private readonly viewer = inject(ImageZoomViewer);

  protected open(): void {
    this.viewer.open(this.src(), this.alt(), this.closeLabel());
  }
}
