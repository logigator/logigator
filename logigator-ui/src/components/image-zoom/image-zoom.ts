import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  inject,
  Injector,
  OnDestroy
} from '@angular/core';
import { ModalOverlay } from '../../internal/modal-overlay';
import { IMAGE_ZOOM_DATA, LgImageZoomOverlay } from './image-zoom-overlay';

/**
 * Opens the images it covers full-size in a modal overlay when they are
 * clicked — for content shown small in the flow of a page (documentation
 * screenshots capped to a readable height) that the reader still needs to be
 * able to look at properly.
 *
 * Put it on an `img` for a single image, or on any container to cover every
 * image inside it — including images that appear later, so rendered markdown
 * and other generated content are covered without wrapping each image. Covered
 * images become focusable and carry a zoom cursor; Enter or Space opens them.
 *
 * Dismiss is Escape, the backdrop, or a click on the enlarged image.
 */
@Directive({
  selector: '[lgImageZoom]',
  host: {
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)'
  }
})
export class LgImageZoom implements AfterViewInit, OnDestroy {
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly overlay = new ModalOverlay(
    inject(Overlay),
    inject(ConfigurableFocusTrapFactory)
  );
  private readonly observer: MutationObserver | null = null;

  constructor() {
    if (!(this.host instanceof HTMLImageElement)) {
      // Content rendered later (markdown swapping pages) brings its own
      // images; attribute changes aren't observed, so the marking below
      // doesn't feed back in.
      this.observer = new MutationObserver(() => this.markImages());
      this.observer.observe(this.host, { childList: true, subtree: true });
    }
  }

  ngAfterViewInit(): void {
    // A container's images are children, so they exist only once the view
    // holding this directive has been built.
    this.markImages();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.overlay.close();
  }

  protected onClick(event: Event): void {
    const image = this.imageOf(event.target);
    if (image) {
      this.open(image);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const image = this.imageOf(event.target);
    if (image) {
      event.preventDefault();
      this.open(image);
    }
  }

  /** The covered image an event came from, or null when it came from elsewhere. */
  private imageOf(target: EventTarget | null): HTMLImageElement | null {
    if (!(target instanceof Node) || !this.host.contains(target)) {
      return null;
    }
    if (this.host instanceof HTMLImageElement) {
      return this.host;
    }
    const image =
      target instanceof Element ? target.closest('img') : target.parentElement;
    return image instanceof HTMLImageElement ? image : null;
  }

  private markImages(): void {
    const images =
      this.host instanceof HTMLImageElement
        ? [this.host]
        : this.host.querySelectorAll('img');
    for (const image of images) {
      image.tabIndex = 0;
      image.style.cursor = 'zoom-in';
    }
  }

  private open(image: HTMLImageElement): void {
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        {
          provide: IMAGE_ZOOM_DATA,
          useValue: {
            src: image.currentSrc || image.src,
            alt: image.alt,
            close: () => this.overlay.close()
          }
        }
      ]
    });
    this.overlay.open(new ComponentPortal(LgImageZoomOverlay, null, injector), {
      placement: 'center',
      dismissOnBackdrop: true,
      onDismiss: () => this.overlay.close()
    });
  }
}
