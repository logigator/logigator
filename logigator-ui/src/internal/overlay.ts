import { ElementRef } from '@angular/core';
import {
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayRef,
  ScrollingVisibility
} from '@angular/cdk/overlay';
import { ScrollDispatcherTarget } from '@angular/cdk/scrolling';
import { map, Observable, Subscription } from 'rxjs';

/**
 * Shared `cdk/overlay` plumbing for anchored overlays: the side→position
 * mapping with flip fallbacks, `withPush`, and a repositioning scroll
 * strategy. Caret drawing and dismissal stay with each consumer.
 */
export type LgOverlaySide = 'top' | 'bottom' | 'left' | 'right';

/** Default gap (px) between the anchor and the overlay. */
export const OVERLAY_GAP = 8;

const OPPOSITE: Record<LgOverlaySide, LgOverlaySide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
};

/** The overlay on `side` of the anchor, centred on it along the other axis. */
export function positionForSide(
  side: LgOverlaySide,
  gap = OVERLAY_GAP
): ConnectedPosition {
  switch (side) {
    case 'top':
      return {
        originX: 'center',
        originY: 'top',
        overlayX: 'center',
        overlayY: 'bottom',
        offsetY: -gap
      };
    case 'bottom':
      return {
        originX: 'center',
        originY: 'bottom',
        overlayX: 'center',
        overlayY: 'top',
        offsetY: gap
      };
    case 'left':
      return {
        originX: 'start',
        originY: 'center',
        overlayX: 'end',
        overlayY: 'center',
        offsetX: -gap
      };
    case 'right':
      return {
        originX: 'end',
        originY: 'center',
        overlayX: 'start',
        overlayY: 'center',
        offsetX: gap
      };
  }
}

/**
 * Positions for a preferred `side`, ordered preferred → opposite →
 * perpendicular, so flip can fall back when the preferred side doesn't fit.
 * Pass a single {@link positionForSide} when flipping would be worse than
 * overflowing.
 */
export function connectedPositions(
  side: LgOverlaySide,
  gap = OVERLAY_GAP
): ConnectedPosition[] {
  const perpendicular: LgOverlaySide[] =
    side === 'top' || side === 'bottom' ? ['right', 'left'] : ['bottom', 'top'];
  const order: LgOverlaySide[] = [side, OPPOSITE[side], ...perpendicular];
  return order.map((s) => positionForSide(s, gap));
}

// A rotated square half-overlapping the panel edge nearest the anchor, so its
// inner half blends into the panel. Keyed by the side the panel sits on; the
// two bordered edges are the ones that protrude.
const CARET_POSITION: Record<LgOverlaySide, string> = {
  top: '-bottom-1.25 left-1/2 -translate-x-1/2 border-r border-b',
  bottom: '-top-1.25 left-1/2 -translate-x-1/2 border-l border-t',
  left: '-right-1.25 top-1/2 -translate-y-1/2 border-t border-r',
  right: '-left-1.25 top-1/2 -translate-y-1/2 border-b border-l'
};

/**
 * The caret's surface per panel background: `content` for a `bg-content`
 * panel, `raised` for the elevated chrome of a tooltip bubble.
 */
export type LgCaretTone = 'content' | 'raised';

const CARET_TONE: Record<LgCaretTone, string> = {
  content: 'bg-content border-border',
  raised: 'bg-content border-border dark:bg-surface-700 dark:border-transparent'
};

export function caretClasses(side: LgOverlaySide, tone: LgCaretTone): string {
  return `rotate-45 ${CARET_POSITION[side]} ${CARET_TONE[tone]}`;
}

export function caretRunsAlongX(side: LgOverlaySide): boolean {
  return side === 'top' || side === 'bottom';
}

// The caret's own diagonal plus the corner radius: how far it may slide from
// the panel's centre before it runs off the straight part of the edge.
const CARET_EDGE_INSET = 16;

/**
 * How far to slide the caret along its edge so it keeps pointing at the
 * anchor. A centred caret points at nothing once `withPush` shoves the panel
 * off the anchor, so pass the panel rect as actually drawn, including any
 * shift the consumer applied itself. Capped short of the corners.
 */
export function caretOffsetFor(
  anchor: DOMRect,
  panel: DOMRect,
  side: LgOverlaySide
): number {
  const alongX = caretRunsAlongX(side);
  const delta = alongX
    ? (anchor.left + anchor.right - panel.left - panel.right) / 2
    : (anchor.top + anchor.bottom - panel.top - panel.bottom) / 2;
  const limit = Math.max(
    0,
    (alongX ? panel.width : panel.height) / 2 - CARET_EDGE_INSET
  );
  return Math.round(Math.min(Math.max(delta, -limit), limit));
}

function strategyOf(ref: OverlayRef): FlexibleConnectedPositionStrategy {
  return ref.getConfig().positionStrategy as FlexibleConnectedPositionStrategy;
}

/**
 * The side a connected overlay actually lands on. Feed it to the caret's
 * `side` input so the caret survives flip fallbacks.
 */
export function caretSideChanges(ref: OverlayRef): Observable<LgOverlaySide> {
  return strategyOf(ref).positionChanges.pipe(
    map((change) => sideOfPosition(change.connectionPair))
  );
}

/**
 * How the anchor sits in its scrollable ancestors, so a consumer can follow it
 * out of a scroller instead of clamping to the viewport edge. Both flags stay
 * false unless the overlay was built with `scrollableAncestors`, and it emits
 * only when the resolved position or the visibility changes, not on every
 * reposition.
 */
export function originVisibilityChanges(
  ref: OverlayRef
): Observable<ScrollingVisibility> {
  return strategyOf(ref).positionChanges.pipe(
    map((change) => change.scrollableViewProperties)
  );
}

/**
 * Runs `onTeardown` when an overlay goes away without its consumer asking:
 * both factories here pass `disposeOnNavigation`, so cdk disposes the overlay
 * itself on a popstate or a hash change — which nulls the pane a consumer
 * would go on reading and leaves its open state stuck around a panel that is
 * gone.
 *
 * Two rules, or the teardown re-enters cdk's: add it to the bag the consumer
 * unsubscribes *before* its own `dispose()`, so only an outside teardown
 * reaches `onTeardown`, and drop the ref inside `onTeardown` before closing,
 * since cdk emits this from inside `dispose()` itself.
 */
export function externalTeardown(
  ref: OverlayRef,
  onTeardown: () => void
): Subscription {
  return ref.detachments().subscribe(onTeardown);
}

export function sideOfPosition(position: ConnectedPosition): LgOverlaySide {
  if (position.overlayY === 'bottom') {
    return 'top';
  }
  if (position.overlayY === 'top') {
    return 'bottom';
  }
  return position.overlayX === 'end' ? 'left' : 'right';
}

export interface ConnectedOverlayOptions {
  origin: ElementRef<HTMLElement> | HTMLElement;
  positions: ConnectedPosition[];
  hasBackdrop?: boolean;
  backdropClass?: string;
  panelClass?: string | string[];
  /** Required for {@link originVisibilityChanges} to report anything. */
  scrollableAncestors?: ScrollDispatcherTarget[];
  /**
   * Whether CDK may shrink the overlay to fit the viewport (its default). Off
   * for a panel that sizes itself: it then gets an exact position rather than
   * being measured into a flexible box, which is also what keeps it placed
   * correctly after its anchor leaves the viewport and comes back.
   */
  flexibleDimensions?: boolean;
}

/**
 * An anchored {@link OverlayRef} with the library's shared defaults. The
 * caller attaches a portal and disposes it, and follows
 * {@link externalTeardown} for the disposal cdk does itself on navigation.
 */
export function createConnectedOverlay(
  overlay: Overlay,
  options: ConnectedOverlayOptions
): OverlayRef {
  const origin =
    options.origin instanceof ElementRef
      ? options.origin.nativeElement
      : options.origin;

  const positionStrategy = overlay
    .position()
    .flexibleConnectedTo(origin)
    .withPush(true)
    .withViewportMargin(OVERLAY_GAP)
    .withFlexibleDimensions(options.flexibleDimensions ?? true)
    .withPositions(options.positions);

  if (options.scrollableAncestors?.length) {
    positionStrategy.withScrollableContainers(options.scrollableAncestors);
  }

  return overlay.create({
    positionStrategy,
    scrollStrategy: overlay.scrollStrategies.reposition(),
    hasBackdrop: options.hasBackdrop ?? false,
    backdropClass: options.backdropClass ?? 'cdk-overlay-transparent-backdrop',
    panelClass: options.panelClass,
    disposeOnNavigation: true
  });
}

/** Where a global (viewport-positioned, non-anchored) overlay sits. */
export type LgOverlayPlacement =
  'center' | 'left' | 'right' | 'top' | 'bottom' | 'bottom-center';

export interface GlobalOverlayOptions {
  placement: LgOverlayPlacement;
  hasBackdrop?: boolean;
  backdropClass?: string | string[];
  panelClass?: string | string[];
  /**
   * Block page scroll while open. Defaults to false: the consumers are
   * full-screen, non-scrolling apps where blocking only risks a layout shift.
   */
  blockScroll?: boolean;
}

/**
 * A global (viewport-positioned) {@link OverlayRef}. Edge placements pin the
 * corner only; the panel supplies its own cross-axis size (`h-screen` for a
 * side drawer, `w-screen` for a bottom/top one). Dismissal stays with the
 * caller, {@link externalTeardown} included.
 */
export function createGlobalOverlay(
  overlay: Overlay,
  options: GlobalOverlayOptions
): OverlayRef {
  const strategy = overlay.position().global();
  switch (options.placement) {
    case 'center':
      strategy.centerHorizontally().centerVertically();
      break;
    case 'left':
      strategy.left('0').top('0');
      break;
    case 'right':
      strategy.right('0').top('0');
      break;
    case 'top':
      strategy.top('0').left('0');
      break;
    case 'bottom':
      strategy.bottom('0').left('0');
      break;
    case 'bottom-center':
      // Bare `bottom()` leaves margin-bottom unset, so the panel's own
      // `panelClass` margin controls how far it floats up.
      strategy.centerHorizontally().bottom();
      break;
  }

  return overlay.create({
    positionStrategy: strategy,
    scrollStrategy: options.blockScroll
      ? overlay.scrollStrategies.block()
      : overlay.scrollStrategies.noop(),
    hasBackdrop: options.hasBackdrop ?? true,
    backdropClass: options.backdropClass ?? 'cdk-overlay-dark-backdrop',
    panelClass: options.panelClass,
    disposeOnNavigation: true
  });
}
