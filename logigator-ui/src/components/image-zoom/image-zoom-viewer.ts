import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable, Injector, OnDestroy } from '@angular/core';
import { ModalOverlay } from '../../internal/modal-overlay';
import { lgLabel } from '../../tokens/labels';
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

  /**
   * The stock label is resolved here rather than at each call site: LgMarkdown
   * opens the viewer directly for images inside rendered markdown, so a default
   * on the component alone would leave that path in English.
   */
  private readonly defaultCloseLabel = lgLabel('close');

  open(
    src: string,
    alt: string,
    closeLabel: string = this.defaultCloseLabel
  ): void {
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        {
          provide: IMAGE_ZOOM_DATA,
          useValue: { src, alt, closeLabel, close: () => this.overlay.close() }
        }
      ]
    });
    this.overlay.open(new ComponentPortal(LgImageZoomOverlay, null, injector), {
      placement: 'center',
      dismissOnBackdrop: true,
      // A click anywhere closes — image and backdrop alike — so the zoom-out
      // cursor covers the whole viewport, not just the image.
      backdropClass: 'cursor-zoom-out',
      onDismiss: () => this.overlay.close()
    });
  }

  ngOnDestroy(): void {
    this.overlay.close();
  }
}
