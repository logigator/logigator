/** What a bottom-pinned panel reads off the visual viewport. */
export interface VisualViewportMetrics {
  readonly height: number;
  readonly offsetTop: number;
  readonly scale: number;
}

/** Where the visible part of a layout viewport ends, seen from its bottom. */
export interface VisualViewportRoom {
  /**
   * How far the visual viewport's bottom edge sits above the layout
   * viewport's: the height an on-screen keyboard covers.
   */
  readonly bottomInset: number;
  /** The visual viewport's height, which is what a panel can fill. */
  readonly height: number;
}

/** Below this, a magnification is rounding noise rather than a pinch-zoom. */
const ZOOM_EPSILON = 0.01;

/**
 * The room left at the bottom of a layout viewport `layoutHeight` tall, or
 * `null` while the visual viewport reaches its bottom edge.
 *
 * An on-screen keyboard shrinks only the visual viewport on iOS Safari, and
 * on Chrome for Android unless the page asks otherwise, so a panel pinned to
 * the layout viewport's bottom sits under it; the browser may pan the visual
 * viewport up as well (`offsetTop`). A pinch-zoomed page has a small visual
 * viewport because it is magnified, not covered, so it reports `null`.
 */
export function visualViewportRoom(
  layoutHeight: number,
  viewport: VisualViewportMetrics
): VisualViewportRoom | null {
  if (viewport.scale > 1 + ZOOM_EPSILON) return null;
  const inset = layoutHeight - viewport.height - viewport.offsetTop;
  if (inset < 1) return null;
  return {
    bottomInset: Math.round(inset),
    height: Math.round(viewport.height)
  };
}

/**
 * Calls `apply` with the {@link visualViewportRoom} of a layout viewport
 * `layoutHeight()` tall now and on every resize and scroll of the visual
 * viewport, until the returned function is called. Nothing happens where
 * `view` has no visual viewport, as on the server.
 */
export function followVisualViewport(
  view: Window | null | undefined,
  layoutHeight: () => number,
  apply: (room: VisualViewportRoom | null) => void
): () => void {
  const viewport = view?.visualViewport;
  if (!viewport) return () => undefined;
  const update = (): void =>
    apply(visualViewportRoom(layoutHeight(), viewport));
  const listeners = new AbortController();
  viewport.addEventListener('resize', update, { signal: listeners.signal });
  viewport.addEventListener('scroll', update, { signal: listeners.signal });
  update();
  return () => listeners.abort();
}
