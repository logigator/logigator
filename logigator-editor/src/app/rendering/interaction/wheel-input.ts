import { ZOOM_STEP_BASE } from '../../project/viewport-controller';

/**
 * What the wheel handler reads off a `wheel` event. Every field but `deltaY`
 * is optional, as the DOM leaves most of them out in some browser.
 */
export interface WheelEventLike {
  clientX: number;
  clientY: number;
  deltaY: number;
  /** `WheelEvent.deltaMode`: 0 pixels (the default), 1 lines, 2 pages. */
  deltaMode?: number;
  /** Set on a trackpad pinch, which browsers deliver as a ctrl-wheel. */
  ctrlKey?: boolean;
  timeStamp?: number;
  preventDefault(): void;
}

// Pixels one mouse-wheel notch reports in Chromium and Firefox. Chromium
// merges the wheel input between two frames into one event and sums its
// delta, so a fast scroll over a slow frame arrives as a single event several
// notches long — which a zoom proportional to the delta takes whole.
const WHEEL_PX_PER_NOTCH = 100;
// `deltaMode` units in pixels: Firefox reports a notch as 3 lines.
const WHEEL_LINE_PX = WHEEL_PX_PER_NOTCH / 3;
const WHEEL_PAGE_PX = 8 * WHEEL_PX_PER_NOTCH;
/** Zoom per wheel pixel: `e^(-px · k)` makes one notch exactly one zoom-button
 *  step, and any delta in between a proportional part of one. */
export const WHEEL_ZOOM_PER_PX = Math.log(ZOOM_STEP_BASE) / WHEEL_PX_PER_NOTCH;

// Below any wheel notch's pixel delta (the smallest known is ~53 px).
const PINCH_MAX_DELTA_PX = 50;

/** A wheel event's delta in pixels, whatever unit it came in. */
export function wheelPixels(
  e: Pick<WheelEventLike, 'deltaMode'>,
  delta: number
): number {
  switch (e.deltaMode) {
    case 1:
      return delta * WHEEL_LINE_PX;
    case 2:
      return delta * WHEEL_PAGE_PX;
    default:
      return delta;
  }
}

/**
 * Whether a ctrl-wheel is a trackpad pinch rather than a ctrl-held mouse wheel:
 * browsers send a pinch as a ctrl-wheel of small pixel deltas, while a wheel
 * notch is 50 px or more, or comes in lines.
 */
export function isPinch(e: WheelEventLike): boolean {
  if (!e.ctrlKey) return false;
  if (e.deltaMode !== undefined && e.deltaMode !== 0) return false;
  return Math.abs(e.deltaY) < PINCH_MAX_DELTA_PX;
}
