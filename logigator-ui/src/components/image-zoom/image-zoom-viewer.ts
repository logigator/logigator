import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable, Injector, OnDestroy } from '@angular/core';
import { ModalOverlay } from '../../internal/modal-overlay';
import { pictureFor } from '../../internal/picture';
import { LgImageSource } from '../../tokens/image-source';
import { lgLabel } from '../../tokens/labels';
import { IMAGE_ZOOM_DATA, LgImageZoomOverlay } from './image-zoom-overlay';

export interface ImageZoomOptions {
  /** ARIA label for the dismiss button; the library's `close` by default. */
  closeLabel?: string;
  /**
   * The image is line art on a transparent ground — a circuit render — and
   * the overlay's dark backdrop would swallow the light theme's dark ink, so
   * the image is framed on the editor's dot ground instead.
   */
  transparent?: boolean;
}

/**
 * Opens an image full-size in a modal overlay, dismissed by Escape, the
 * backdrop, or a click on the image. Component-provided rather than root, so
 * an open overlay closes with the providing component.
 *
 * The image is one URL or a whole ladder; given a ladder, the browser picks the
 * rung for the overlay's size rather than enlarging the one a smaller frame
 * was drawn with. Either way the image is never shown past 100%: a URL at its
 * natural size, a ladder at its widest rung's.
 */
@Injectable()
export class ImageZoomViewer implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly overlay = new ModalOverlay(inject(Overlay), this.injector);

  /**
   * Resolved here rather than per call site: LgMarkdown opens the viewer
   * directly, so a default on the component alone leaves that path in English.
   */
  private readonly defaultCloseLabel = lgLabel('close');

  open(
    image: string | readonly LgImageSource[],
    alt: string,
    options: ImageZoomOptions = {}
  ): void {
    const picture = pictureFor(image);
    if (!picture) return;
    const width =
      typeof image === 'string'
        ? null
        : Math.max(...image.map((source) => source.width));
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        {
          provide: IMAGE_ZOOM_DATA,
          useValue: {
            picture,
            width,
            alt,
            transparent: options.transparent ?? false,
            closeLabel: options.closeLabel ?? this.defaultCloseLabel,
            close: () => this.overlay.close()
          }
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
