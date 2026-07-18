import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { inject, Injectable } from '@angular/core';
import {
  ConnectedOverlayOptions,
  createConnectedOverlay,
  createGlobalOverlay,
  GlobalOverlayOptions
} from '../../internal/overlay';

/**
 * Thin injectable over the library's connected/global overlay helpers.
 *
 * The CDK wiring — flexible connected positioning with `withPush`, a viewport
 * margin, and a repositioning scroll strategy for anchored overlays; centred or
 * edge-pinned placement for global ones — already lives in `internal/overlay`,
 * shared by the library's own overlay-backed components. This service exposes
 * that same substrate so consumers can imperatively anchor a floating panel to
 * any element and keep it repositioned, without re-implementing the wiring.
 *
 * It only builds the {@link OverlayRef}; attaching a portal, drawing any caret,
 * and wiring dismissal stay with the caller (those differ per consumer). The
 * library's existing overlay components are deliberately **not** migrated onto
 * it — what remains per component is divergent dismiss/keyboard/caret behaviour,
 * not boilerplate a service could absorb.
 */
@Injectable({ providedIn: 'root' })
export class LgOverlayService {
  private readonly overlay = inject(Overlay);

  /** Anchored overlay tracking `origin`, repositioned on scroll/resize. */
  public connected(options: ConnectedOverlayOptions): OverlayRef {
    return createConnectedOverlay(this.overlay, options);
  }

  /** Viewport-positioned overlay: centred, or pinned to an edge. */
  public global(options: GlobalOverlayOptions): OverlayRef {
    return createGlobalOverlay(this.overlay, options);
  }
}
