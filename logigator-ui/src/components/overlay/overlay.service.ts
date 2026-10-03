import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { inject, Injectable } from '@angular/core';
import {
  ConnectedOverlayOptions,
  createConnectedOverlay,
  createGlobalOverlay,
  GlobalOverlayOptions
} from '../../internal/overlay';

/**
 * Thin injectable over the CDK wiring in `internal/overlay`, so a consumer can
 * imperatively anchor a floating panel to any element and keep it
 * repositioned. It only builds the {@link OverlayRef}: the portal, any caret,
 * and dismissal stay with the caller, since those differ per consumer.
 */
@Injectable({ providedIn: 'root' })
export class LgOverlayService {
  private readonly overlay = inject(Overlay);
  private readonly scrollDispatcher = inject(ScrollDispatcher);

  /**
   * Anchored overlay tracking `origin`, repositioned on scroll/resize. The
   * anchor's scrollable ancestors are resolved here so
   * `originVisibilityChanges` reports when it scrolls out of them; they feed
   * CDK's visibility reporting only, never its positioning.
   */
  public connected(options: ConnectedOverlayOptions): OverlayRef {
    return createConnectedOverlay(this.overlay, {
      ...options,
      scrollableAncestors: this.scrollDispatcher.getAncestorScrollContainers(
        options.origin
      )
    });
  }

  /** Viewport-positioned overlay: centred, or pinned to an edge. */
  public global(options: GlobalOverlayOptions): OverlayRef {
    return createGlobalOverlay(this.overlay, options);
  }
}
