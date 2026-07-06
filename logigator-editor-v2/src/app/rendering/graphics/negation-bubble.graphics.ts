import { StaticGraphicsContext } from './static-graphics-context';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** Bubble radius in grid units — scales with zoom like the component body. */
export const NEGATION_BUBBLE_RADIUS = 0.2;
/** Bubble outline width in grid units (2px at 100% zoom, matching the body). */
export const NEGATION_BUBBLE_STROKE = 2 * PX;

/**
 * The IEC/ANSI inverter "bubble": a small circle drawn at the body-edge end of
 * a negated port's stub. Filled with the canvas background so it interrupts the
 * stub, stroked with the wire colour. `lit` fills it with the wire colour
 * instead, used during simulation to show the gate-side logic value
 * (link state XOR negated) — the inverse of the stub's link state.
 *
 * Grid-sized (radius and stroke both in grid units) and cached per theme +
 * lit state, so all bubbles share one context and the context survives zoom
 * unchanged (mirroring the port stub).
 */
export class NegationBubbleGraphics extends StaticGraphicsContext {
  constructor(lit = false) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    this.circle(0, 0, NEGATION_BUBBLE_RADIUS);
    this.fill(lit ? theme.wire : theme.background);
    this.stroke({ color: theme.wire, width: NEGATION_BUBBLE_STROKE });
  }
}
