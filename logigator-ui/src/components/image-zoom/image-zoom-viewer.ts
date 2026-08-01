import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable, Injector, OnDestroy } from '@angular/core';
import { ModalOverlay } from '../../internal/modal-overlay';
import { IMAGE_ZOOM_DATA, LgImageZoomOverlay } from './image-zoom-overlay';

/**
 * Opens an image full-size in a modal overlay — the machinery behind
 * `LgImageZoom` and `LgMarkdown`'s zoomable content images. Component-provided
 * (not root) so an open overlay closes when the providing component is
 * destroyed.
 *
 * Dismiss is Escape, the backdrop, or a click on the enlarged image.
 */
@Injectable()
export class ImageZoomViewer implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly overlay = new ModalOverlay(
    inject(Overlay),
    inject(ConfigurableFocusTrapFactory)
  );

  open(src: string, alt: string): void {
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        {
          provide: IMAGE_ZOOM_DATA,
          useValue: { src, alt, close: () => this.overlay.close() }
        }
      ]
    });
    this.overlay.open(new ComponentPortal(LgImageZoomOverlay, null, injector), {
      placement: 'center',
      dismissOnBackdrop: true,
      onDismiss: () => this.overlay.close()
    });
  }

  ngOnDestroy(): void {
    this.overlay.close();
  }
}
