import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable, Injector, OnDestroy } from '@angular/core';
import { ModalOverlay } from '../../internal/modal-overlay';
import { lgLabel } from '../../tokens/labels';
import { IMAGE_ZOOM_DATA, LgImageZoomOverlay } from './image-zoom-overlay';

/**
 * Opens an image full-size in a modal overlay, dismissed by Escape, the
 * backdrop, or a click on the image. Component-provided rather than root, so
 * an open overlay closes with the providing component.
 */
@Injectable()
export class ImageZoomViewer implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly overlay = new ModalOverlay(
    inject(Overlay),
    inject(ConfigurableFocusTrapFactory)
  );

  /**
   * Resolved here rather than per call site: LgMarkdown opens the viewer
   * directly, so a default on the component alone leaves that path in English.
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
      // A click anywhere closes, so the zoom-out cursor covers the whole
      // viewport rather than just the image.
      backdropClass: 'cursor-zoom-out',
      onDismiss: () => this.overlay.close()
    });
  }

  ngOnDestroy(): void {
    this.overlay.close();
  }
}
