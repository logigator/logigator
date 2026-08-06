import { ElementRef } from '@angular/core';
import {
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayRef,
  ScrollingVisibility
} from '@angular/cdk/overlay';
import { ScrollDispatcherTarget } from '@angular/cdk/scrolling';
import { map, Observable } from 'rxjs';

/**
 * Shared `cdk/overlay` plumbing for the connected (anchored) overlays — the
 * most-reused behavioral primitive in the library (Tooltip, Popover,
 * ConfirmPopup, Select, menus). It owns the bits every anchored overlay gets
 * right the same way: the side→position mapping with sensible flip fallbacks,
 * `withPush`, and a repositioning scroll strategy.
 *
 * Drawing the caret/arrow and wiring dismissal stay with each consumer (they
 * differ — a tooltip dismisses on blur, a popover on outside-click), but
 * {@link caretSideChanges} lets a consumer read back which side actually won so
 * it can place its caret.
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
 * Positions for a preferred `side`, ordered preferred → opposite → the two
 * perpendicular sides, so `withPush`/flip can fall back when the preferred side
 * doesn't fit the viewport. Pass a single {@link positionForSide} instead when
 * the side is fixed and flipping would be worse than overflowing.
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

// Diamond caret pointing toward the anchor: a rotated square parked
// half-overlapping the panel edge nearest the anchor, so its inner half blends
// into the panel and its outward corner shows the panel's border on the two
// protruding edges. Keyed by the side the panel sits on relative to the
// anchor; the entries pick which two edges carry the border width.
const CARET_POSITION: Record<LgOverlaySide, string> = {
  top: '-bottom-1.25 left-1/2 -translate-x-1/2 border-r border-b',
  bottom: '-top-1.25 left-1/2 -translate-x-1/2 border-l border-t',
  left: '-right-1.25 top-1/2 -translate-y-1/2 border-t border-r',
  right: '-left-1.25 top-1/2 -translate-y-1/2 border-b border-l'
};

/**
 * The caret's surface per panel background: `content` pairs with a
 * `bg-content` panel (Popover, ConfirmPopup), `raised` with the elevated
 * chrome (the Tooltip bubble: the bordered content surface in light, the
 * borderless `surface-700` box in dark).
 */
export type LgCaretTone = 'content' | 'raised';

const CARET_TONE: Record<LgCaretTone, string> = {
  content: 'bg-content border-border',
  raised: 'bg-content border-border dark:bg-surface-700 dark:border-transparent'
};

/** Tailwind classes for a caret pointing at the anchor from the given side. */
export function caretClasses(side: LgOverlaySide, tone: LgCaretTone): string {
  return `rotate-45 ${CARET_POSITION[side]} ${CARET_TONE[tone]}`;
}

/** The caret rides the panel's horizontal edge, so it slides along X. */
export function caretRunsAlongX(side: LgOverlaySide): boolean {
  return side === 'top' || side === 'bottom';
}

/**
 * How far the caret may slide from the panel's centre before it runs off the
 * straight part of the edge — its own diagonal plus the corner radius.
 */
const CARET_EDGE_INSET = 16;

/**
 * How far to slide the caret along its edge so it keeps pointing at the anchor,
 * for {@link LgCaret}'s `offset`. It defaults to the panel's centre, which is
 * the anchor's centre only while the panel straddles it — near a screen edge or
 * a scroller bound the panel is pushed aside and a centred caret then points at
 * nothing. Pass the panel rect as it is actually drawn (including any shift the
 * consumer applied itself); capped short of the corners.
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

/** The flexible position strategy an anchored {@link OverlayRef} was built with. */
function strategyOf(ref: OverlayRef): FlexibleConnectedPositionStrategy {
  return ref.getConfig().positionStrategy as FlexibleConnectedPositionStrategy;
}

/**
 * The side a connected overlay actually lands on, per resolved position of its
 * flexible strategy — feed it to the caret's `side` input so the caret keeps
 * pointing at the anchor across flip fallbacks.
 */
export function caretSideChanges(ref: OverlayRef): Observable<LgOverlaySide> {
  return strategyOf(ref).positionChanges.pipe(
    map((change) => sideOfPosition(change.connectionPair))
  );
}

/**
 * How the anchor sits in its scrollable ancestors, per resolved position —
 * `isOriginClipped` once it is partly scrolled out, `isOriginOutsideView` once
 * it is gone entirely. Lets a consumer follow its anchor out of a scroller
 * instead of clamping to the viewport edge, pointing at nothing.
 *
 * Only meaningful when the overlay was built with scrollable ancestors;
 * without them CDK has nothing to clip against and both stay false.
 * `LgOverlayService.connected` resolves them, so overlays built by calling
 * {@link createConnectedOverlay} directly must pass `scrollableAncestors`
 * themselves. Note it emits only when the resolved position or the visibility
 * itself changes — not on every reposition.
 */
export function originVisibilityChanges(
  ref: OverlayRef
): Observable<ScrollingVisibility> {
  return strategyOf(ref).positionChanges.pipe(
    map((change) => change.scrollableViewProperties)
  );
}

/** Which side a resolved {@link ConnectedPosition} placed the overlay on. */
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
  /**
   * The anchor's scrollable ancestors, so CDK can report how the anchor sits in
   * them (see {@link originVisibilityChanges}). `LgOverlayService.connected`
   * resolves these from the `ScrollDispatcher`.
   */
  scrollableAncestors?: ScrollDispatcherTarget[];
  /**
   * Whether CDK may shrink the overlay to fit the viewport (its default). Turn
   * it off for a panel that sizes itself — it then gets an exact position
   * instead of being measured into a flexible box, which is both what such a
   * panel wants and, observed, what keeps it correctly placed after its anchor
   * has left the viewport and come back.
   */
  flexibleDimensions?: boolean;
}

/**
 * Build an anchored {@link OverlayRef} with the library's shared defaults:
 * flexible connected positioning with `withPush`, a viewport margin, and a
 * repositioning scroll strategy. The caller attaches a portal and disposes it.
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

/**
 * Where a global (viewport-positioned, non-anchored) overlay sits: centred for
 * modal dialogs, pinned to an edge for drawers, or floated bottom-centre (a
 * horizontally centred toast/hint pinned to the bottom edge — the panel supplies
 * its own bottom offset via `panelClass`).
 */
export type LgOverlayPlacement =
  'center' | 'left' | 'right' | 'top' | 'bottom' | 'bottom-center';

export interface GlobalOverlayOptions {
  placement: LgOverlayPlacement;
  hasBackdrop?: boolean;
  backdropClass?: string | string[];
  panelClass?: string | string[];
  /**
   * Block page scroll while open. Defaults to **false** — the consumers are
   * full-screen, non-scrolling apps where blocking only risks a layout shift.
   */
  blockScroll?: boolean;
}

/**
 * Build a global (viewport-positioned) {@link OverlayRef}: centred for modal
 * dialogs, edge-pinned for drawers. Edge placements pin the corner; the panel
 * itself supplies the cross-axis size (`h-screen` for a side drawer, `w-screen`
 * for a bottom/top one). Backdrop and dismissal wiring stay with the caller.
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
      // Centre horizontally, pin to the bottom edge with no baked-in offset —
      // `bottom()` leaves margin-bottom unset so the panel's own `panelClass`
      // margin controls how far it floats up.
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
