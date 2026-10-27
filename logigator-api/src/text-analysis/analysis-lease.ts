/**
 * How long a claim holds a document. Far above one document's work — two calls
 * of at most a minute each — so a live worker never loses a row it is still
 * analyzing, while a crashed one's rows come back within minutes.
 */
export const ANALYSIS_LEASE_MINUTES = 10;

const LEASE_MS = ANALYSIS_LEASE_MINUTES * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** The UTC calendar day `now` falls in, as `YYYY-MM-DD`. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Midnight UTC at the end of the day `now` falls in. */
export function startOfNextUtcDay(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
}

/**
 * The claim time that makes a lease run out at `instant`. A claim is free again
 * once it is older than the lease term, so writing this holds a row until
 * then without a column of its own.
 */
export function leaseRunningOutAt(instant: number): Date {
  return new Date(instant - LEASE_MS);
}
