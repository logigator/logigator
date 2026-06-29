import { ElementRef } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';

/**
 * Shared `cdk/overlay` plumbing for the connected (anchored) overlays — the
 * most-reused behavioral primitive in the library (Tooltip, Popover,
 * ConfirmPopup, Select, menus). It owns the bits every anchored overlay gets
 * right the same way: the side→position mapping with sensible flip fallbacks,
 * `withPush`, and a repositioning scroll strategy.
 *
 * Drawing the caret/arrow and wiring dismissal stay with each consumer (they
 * differ — a tooltip dismisses on blur, a popover on outside-click), but
 * {@link sideOfPosition} lets a consumer read back which side actually won so it
 * can place its caret. The centered/edge-pinned *global* overlays (modals,
 * drawer) are added with their first consumer.
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

function positionForSide(side: LgOverlaySide, gap: number): ConnectedPosition {
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
 * doesn't fit the viewport.
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

// CSS-triangle caret pointing toward the anchor, parked on the panel edge
// nearest it. Keyed by the side the panel sits on relative to the anchor. The
// triangle is `content`-colored; pair it with a `bg-content` panel.
const CARET: Record<LgOverlaySide, string> = {
  top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-x-[6px] border-x-transparent border-t-[6px] border-t-content',
  bottom:
    'top-[-6px] left-1/2 -translate-x-1/2 border-x-[6px] border-x-transparent border-b-[6px] border-b-content',
  left: 'right-[-6px] top-1/2 -translate-y-1/2 border-y-[6px] border-y-transparent border-l-[6px] border-l-content',
  right:
    'left-[-6px] top-1/2 -translate-y-1/2 border-y-[6px] border-y-transparent border-r-[6px] border-r-content'
};

/** Tailwind classes for a caret pointing at the anchor from the given side. */
export function caretClasses(side: LgOverlaySide): string {
  return CARET[side];
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
    .withPositions(options.positions);

  return overlay.create({
    positionStrategy,
    scrollStrategy: overlay.scrollStrategies.reposition(),
    hasBackdrop: options.hasBackdrop ?? false,
    backdropClass: options.backdropClass ?? 'cdk-overlay-transparent-backdrop',
    panelClass: options.panelClass,
    disposeOnNavigation: true
  });
}
