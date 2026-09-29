import { describe, expect, it } from 'vitest';
import { MIN_TARGET_HZ } from '../../simulation/worker/pacing';
import {
  formatHz,
  nearestStopIndex,
  parseSpeed,
  SPEED_STOPS
} from './sim-speed';

describe('sim-speed', () => {
  it('spans 1 Hz to 10 MHz in exact 1-2-5 steps', () => {
    expect(SPEED_STOPS[0]).toBe(1);
    expect(SPEED_STOPS.at(-1)).toBe(10_000_000);
    expect(SPEED_STOPS.slice(0, 4)).toEqual([1, 2, 5, 10]);
    for (let i = 1; i < SPEED_STOPS.length; i++) {
      expect(SPEED_STOPS[i]).toBeGreaterThan(SPEED_STOPS[i - 1]);
    }
  });

  it('maps a rate to the logarithmically nearest stop', () => {
    expect(SPEED_STOPS[nearestStopIndex(1000)]).toBe(1000);
    expect(SPEED_STOPS[nearestStopIndex(3)]).toBe(2);
    expect(SPEED_STOPS[nearestStopIndex(4)]).toBe(5);
    expect(nearestStopIndex(MIN_TARGET_HZ)).toBe(0);
    expect(nearestStopIndex(1e9)).toBe(SPEED_STOPS.length - 1);
  });

  it('reads prefixes, a decimal comma and an optional unit', () => {
    expect(parseSpeed('10')).toBe(10);
    expect(parseSpeed('2.5k')).toBe(2500);
    expect(parseSpeed(' 2,5 kHz ')).toBe(2500);
    expect(parseSpeed('1M')).toBe(1_000_000);
    expect(parseSpeed('1 mhz')).toBe(1_000_000);
    expect(parseSpeed('.5 Hz')).toBe(0.5);
  });

  it('rejects text that is not a rate, or one slower than the floor', () => {
    expect(parseSpeed('')).toBeNull();
    expect(parseSpeed('fast')).toBeNull();
    expect(parseSpeed('-5')).toBeNull();
    expect(parseSpeed('1 GHz')).toBeNull();
    expect(parseSpeed('0.05')).toBeNull();
    expect(parseSpeed('0')).toBeNull();
  });

  it('formats in the unit that keeps the number short', () => {
    expect(formatHz(0.5, 'en')).toBe('0.5\u00a0Hz');
    expect(formatHz(60, 'en')).toBe('60\u00a0Hz');
    expect(formatHz(2500, 'en')).toBe('2.5\u00a0kHz');
    expect(formatHz(999_600, 'en')).toBe('1\u00a0MHz');
    expect(formatHz(2500, 'de')).toBe('2,5\u00a0kHz');
  });

  it('formats every stop, and large rates, as text that parses back', () => {
    for (const hz of [MIN_TARGET_HZ, 0.5, ...SPEED_STOPS, 4_560_000_000]) {
      for (const lang of ['en', 'de', 'fr', 'es']) {
        expect(parseSpeed(formatHz(hz, lang))).toBe(hz);
      }
    }
  });
});
