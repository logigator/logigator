import { describe, expect, it } from 'vitest';
import { nextPaceDelayMs, PACE_INTERVAL_MS, ticksDue } from './pacing';

describe('pacing', () => {
  describe('ticksDue', () => {
    it('is the wall-clock deficit since the run started', () => {
      // 1 kHz for 100 ms = 100 ticks expected; 40 already run → 60 due.
      expect(ticksDue(1000, 100, 40)).toBe(60);
    });

    it('floors fractional ticks', () => {
      // 1 kHz for 1.9 ms = 1.9 expected → floor 1.
      expect(ticksDue(1000, 1.9, 0)).toBe(1);
    });

    it('is zero or negative once caught up or ahead', () => {
      expect(ticksDue(1000, 100, 100)).toBe(0);
      expect(ticksDue(1000, 100, 150)).toBe(-50);
    });

    it('scales the deficit with the target rate, not a fixed cap', () => {
      // The batch is bounded by wall-clock ms at the call site, not by
      // clamping this value.
      expect(ticksDue(5_000_000, 1000, 0)).toBe(5_000_000);
    });
  });

  describe('nextPaceDelayMs', () => {
    it('idles a full interval when caught up', () => {
      expect(nextPaceDelayMs(0, 0)).toBe(PACE_INTERVAL_MS);
      expect(nextPaceDelayMs(-5, 0)).toBe(PACE_INTERVAL_MS);
    });

    it('idles a full interval when the batch met the full deficit', () => {
      expect(nextPaceDelayMs(50, 50)).toBe(PACE_INTERVAL_MS);
    });

    it('reschedules back-to-back when the budget cut the batch short', () => {
      // Only 40_000 of 5_000_000 ran within the ms budget → still behind.
      expect(nextPaceDelayMs(5_000_000, 40_000)).toBe(0);
    });
  });
});
