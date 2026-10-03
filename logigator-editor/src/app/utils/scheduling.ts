/** Resolves on the next animation frame. */
export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Resolves when the browser reports idle time, or after `timeoutMs` under
 * sustained load. Without `requestIdleCallback` (Safari) idleness cannot be
 * detected, so it degrades to a macrotask yield rather than adding latency.
 */
export function whenIdle(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: timeoutMs });
    } else {
      setTimeout(resolve, 0);
    }
  });
}
