/**
 * Run `fn` after the browser has painted the current frame (a double
 * `requestAnimationFrame`). Overlays and toasts use it to let the "from" state
 * of an enter transition paint before flipping to the target state — which is
 * what actually makes the CSS transition run. Falls back to a synchronous call
 * where rAF is unavailable (jsdom / SSR), so behaviour stays testable.
 */
export function afterPaint(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  } else {
    fn();
  }
}
