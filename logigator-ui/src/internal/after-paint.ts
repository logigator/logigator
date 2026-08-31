/**
 * Run `fn` after the browser has painted the current frame, via a double
 * `requestAnimationFrame`. An enter transition needs its "from" state painted
 * before the flip, or the CSS transition never runs. Falls back to a
 * synchronous call where rAF is unavailable, so behaviour stays testable.
 */
export function afterPaint(fn: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(fn));
  } else {
    fn();
  }
}
