/**
 * Ratio between neighbouring rungs of the stroke-scale ladder. A stroke baked
 * at the nearest rung is at most half a rung off its intended width: ±2.5%,
 * which keeps a 2 px body stroke between 1.95 and 2.05 px.
 */
export const STROKE_SCALE_BASE = 1.05;

const LOG_BASE = Math.log(STROKE_SCALE_BASE);

/**
 * The scale a scale-keyed, cached `GraphicsContext` is baked at for a given
 * zoom scale: the nearest rung of a fine geometric ladder.
 *
 * The zoom itself is continuous — the wheel and pinches set any scale — but
 * `GraphicsProviderService` caches contexts per exact parameter set and never
 * evicts them. Keyed by the raw scale, every wheel event would bake a new
 * context for every body size on screen, growing the cache for the whole
 * session and rebuilding every visible render group each frame. Snapped to a
 * rung, the cache holds a few dozen scales across the whole zoom range, and a
 * zoom that stays within one rung swaps no context at all.
 *
 * Only cached contexts go through this. Compensation applied as a transform —
 * port stubs, wires, dot sizes — stays exact, since a transform write costs
 * nothing to vary.
 */
export function strokeScaleFor(scale: number): number {
  return Math.pow(STROKE_SCALE_BASE, Math.round(Math.log(scale) / LOG_BASE));
}
