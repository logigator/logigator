import { StaticGraphicsContext } from './static-graphics-context';
import { PX } from '../../utils/grid';
import { clamp } from '../../utils/math';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** On-screen bubble diameter at 100% zoom; scales with the board around here. */
export const DIAMETER = 5 * PX;
/** Smallest on-screen bubble diameter; the floor when zoomed out. */
export const MIN_DIAMETER = 3 * PX;
/** Largest on-screen bubble diameter; the ceiling when zoomed in. */
export const MAX_DIAMETER = 10 * PX;
/** On-screen border thickness, held constant at every zoom. */
export const BORDER = PX;

// Grid-unit dot size, applied as the bubble Graphics' transform: DIAMETER
// across (so it scales with the board), clamped to a fixed pixel floor/ceiling
// on screen — the `/ scale` on the bounds counter-scales the zoom.
export function scaleForScale(scale: number): number {
  return clamp(DIAMETER, MIN_DIAMETER / scale, MAX_DIAMETER / scale);
}

/**
 * The IEC/ANSI inverter "bubble": a small white dot drawn at the body-edge end
 * of a negated port's stub. Filled white so it interrupts the stub, stroked
 * with the wire color (green in dark, black in light).
 *
 * A unit-diameter circle transform-scaled by {@link scaleForScale}, so the dot
 * follows that size curve. The border must stay a constant on-screen thickness,
 * so it can't ride that transform: the baked width divides BORDER back out by
 * the dot's transform (`scaleForScale · zoom`), so it renders `BORDER · gridSize`
 * px (i.e. 1px) at every zoom. That makes the context zoom-dependent, re-fetched
 * per `applyScale` (like the component body outline).
 */
export class NegationBubbleGraphics extends StaticGraphicsContext {
  constructor(scale: number) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    this.circle(0, 0, 0.5);
    this.fill(0xffffff);
    this.stroke({
      color: theme.wire,
      width: BORDER / (scaleForScale(scale) * scale)
    });
  }
}
