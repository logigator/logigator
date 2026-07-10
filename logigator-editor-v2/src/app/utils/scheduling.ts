/** Resolves on the next animation frame. */
export function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Resolves when the browser reports idle time, or after `timeoutMs` under
 * sustained load so the caller is never starved indefinitely. Where
 * `requestIdleCallback` is unavailable (Safari), idleness cannot be detected,
 * so this degrades to a plain macrotask yield instead of adding artificial
 * latency.
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
