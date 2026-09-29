import { MIN_TARGET_HZ } from '../../simulation/worker/pacing';

/**
 * The speed slider's end detents. The text field reaches past both ends: down
 * to {@link MIN_TARGET_HZ} and up without a limit.
 */
const MIN_STOP_HZ = 1;
const MAX_STOP_HZ = 10_000_000;

/**
 * The speed slider's detents: a 1-2-5 series from 1 Hz to 10 MHz, so every
 * decade gets the same travel.
 */
export const SPEED_STOPS: readonly number[] = buildStops();

function buildStops(): number[] {
  const stops: number[] = [];
  for (let exponent = Math.log10(MIN_STOP_HZ); ; exponent++) {
    for (const mantissa of [1, 2, 5]) {
      const hz = Number((mantissa * 10 ** exponent).toPrecision(1));
      if (hz > MAX_STOP_HZ) {
        return stops;
      }
      stops.push(hz);
    }
  }
}

/** The detent closest to `hz` on the slider's logarithmic scale. */
export function nearestStopIndex(hz: number): number {
  let best = 0;
  for (let i = 1; i < SPEED_STOPS.length; i++) {
    if (
      Math.abs(Math.log(hz / SPEED_STOPS[i])) <
      Math.abs(Math.log(hz / SPEED_STOPS[best]))
    ) {
      best = i;
    }
  }
  return best;
}

// A decimal comma or point, an optional k/M prefix and an optional "Hz", all
// case-insensitive: a frequency field has no use for milli, so `m` is mega.
const SPEED_PATTERN = /^\s*(\d+(?:[.,]\d*)?|[.,]\d+)\s*([km])?\s*(?:hz)?\s*$/i;

/**
 * Reads a typed speed — `10`, `2.5k`, `2,5 kHz`, `1M` — as Hz, or `null` when
 * it does not parse or is slower than {@link MIN_TARGET_HZ}.
 */
export function parseSpeed(text: string): number | null {
  const match = SPEED_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const prefix = match[2]?.toLowerCase();
  const scale = prefix === 'k' ? 1_000 : prefix === 'm' ? 1_000_000 : 1;
  const hz = Number(match[1].replace(',', '.')) * scale;
  return Number.isFinite(hz) && hz >= MIN_TARGET_HZ ? hz : null;
}

/**
 * A rate to three significant digits in Hz, kHz or MHz, in the reader's
 * number format. Ungrouped, so what the speed field shows parses back.
 */
export function formatHz(hz: number, lang: string): string {
  const rounded = Number(hz.toPrecision(3));
  const [scale, unit] =
    rounded >= 1_000_000
      ? [1_000_000, 'MHz']
      : rounded >= 1_000
        ? [1_000, 'kHz']
        : [1, 'Hz'];
  const value = new Intl.NumberFormat(lang, {
    maximumSignificantDigits: 3,
    useGrouping: false
  }).format(rounded / scale);
  // Non-breaking, so a wrapped line never parts a number from its unit.
  return `${value}\u00a0${unit}`;
}
