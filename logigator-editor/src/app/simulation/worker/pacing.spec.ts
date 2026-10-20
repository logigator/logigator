import { describe, expect, it } from 'vitest';
import { ticksDue } from './pacing';

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
      // `runAsync` splits the run into short batches at the call site; this
      // value is never clamped.
      expect(ticksDue(5_000_000, 1000, 0)).toBe(5_000_000);
    });
  });
});
