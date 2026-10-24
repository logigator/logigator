import { describe, expect, it } from 'vitest';
import { STROKE_SCALE_BASE, strokeScaleFor } from './stroke-scale';
import {
  ZOOM_STEP_BASE,
  ZOOM_STEP_MAX,
  ZOOM_STEP_MIN
} from '../../project/viewport-controller';

describe('strokeScaleFor', () => {
  it('stays within half a rung of the scale it snaps', () => {
    const halfRung = Math.sqrt(STROKE_SCALE_BASE);
    for (let scale = 0.1; scale < 2.5; scale *= 1.013) {
      const ratio = strokeScaleFor(scale) / scale;
      expect(ratio).toBeLessThanOrEqual(halfRung + 1e-12);
      expect(ratio).toBeGreaterThanOrEqual(1 / halfRung - 1e-12);
    }
  });

  it('bounds the scales it hands out over the whole zoom range', () => {
    const min = Math.pow(ZOOM_STEP_BASE, ZOOM_STEP_MIN);
    const max = Math.pow(ZOOM_STEP_BASE, ZOOM_STEP_MAX);
    const rungs = new Set<number>();
    for (let scale = min; scale <= max; scale *= 1.001) {
      rungs.add(strokeScaleFor(scale));
    }
    // log(max / min) / log(1.05) ≈ 67 rungs, plus the two ends.
    expect(rungs.size).toBeLessThanOrEqual(70);
  });

  it('gives one value per rung, so cache keys built from it repeat exactly', () => {
    expect(strokeScaleFor(1.001)).toBe(strokeScaleFor(0.999));
    expect(strokeScaleFor(1)).toBe(1);
  });
});
