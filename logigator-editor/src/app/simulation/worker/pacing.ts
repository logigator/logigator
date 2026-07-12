/**
 * Target-mode pacing constants and the pure batch-planning logic, split out of
 * the worker so it can be unit-tested without the WASM engine (the worker
 * module top-level-imports the engine and worker globals).
 */

/** Pacing interval when caught up — small enough to keep input latency low. */
export const PACE_INTERVAL_MS = 10;

/**
 * Wall-clock budget for one catch-up batch. Short enough that the worker's
 * message pump (snapshot/input handling) stays responsive between runs, so a
 * high target rate can't monopolize the worker in one long synchronous `run`
 * and starve the per-frame snapshot pull.
 */
export const PACE_BATCH_MS = 5;

/**
 * The ticks the wall clock says are still due since the run started, from the
 * target rate, elapsed wall-clock time, and ticks already simulated this run.
 * Zero or negative means caught up (or ahead).
 */
export function ticksDue(
  paceHz: number,
  elapsedMs: number,
  ticksSinceStart: number
): number {
  return Math.floor((paceHz * elapsedMs) / 1000) - ticksSinceStart;
}

/**
 * Delay before the next pace iteration. When a batch is cut short by the
 * wall-clock budget (`ran < due`) the engine is behind an unreachable target,
 * so the next batch runs back-to-back (0 ms, yielding only to the message
 * queue) rather than wasting an idle interval; otherwise it idles a full
 * interval until the next tick is due.
 */
export function nextPaceDelayMs(due: number, ran: number): number {
  return due > 0 && ran < due ? 0 : PACE_INTERVAL_MS;
}
