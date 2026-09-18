/**
 * Target-mode pacing constants and the pure batch-planning logic, split out of
 * the worker so it is unit-testable without the WASM engine (the worker module
 * top-level-imports the engine and worker globals).
 */

/** Pacing interval when caught up — small enough to keep input latency low. */
export const PACE_INTERVAL_MS = 10;

/**
 * Wall-clock budget for one catch-up batch: short enough that a high target
 * rate can't monopolize the worker in one long synchronous `run` and starve the
 * per-frame snapshot pull.
 */
export const PACE_BATCH_MS = 5;

/**
 * Ticks still due since the run started. Zero or negative means caught up.
 */
export function ticksDue(
  paceHz: number,
  elapsedMs: number,
  ticksSinceStart: number
): number {
  return Math.floor((paceHz * elapsedMs) / 1000) - ticksSinceStart;
}

/**
 * Delay before the next pace iteration. A batch cut short by the wall-clock
 * budget (`ran < due`) means the target is unreachable, so the next batch runs
 * back-to-back, yielding only to the message queue.
 */
export function nextPaceDelayMs(due: number, ran: number): number {
  return due > 0 && ran < due ? 0 : PACE_INTERVAL_MS;
}
