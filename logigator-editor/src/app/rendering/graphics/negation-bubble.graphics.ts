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

// Grid-unit dot size for the bubble Graphics' transform: DIAMETER across,
// clamped to fixed on-screen bounds by counter-scaling the zoom.
export function scaleForScale(scale: number): number {
  return clamp(DIAMETER, MIN_DIAMETER / scale, MAX_DIAMETER / scale);
}

/**
 * The IEC/ANSI inverter bubble at the body-edge end of a negated port's stub:
 * filled white so it interrupts the stub, stroked with the wire color.
 *
 * A unit-diameter circle transform-scaled by {@link scaleForScale}. The border
 * must stay a constant on-screen thickness, so it cannot ride that transform:
 * the baked width divides BORDER back out by `scaleForScale · zoom` to render
 * 1px at every zoom. That makes the context zoom-dependent, re-fetched per
 * `applyScale`.
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
