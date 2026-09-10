import { StaticGraphicsContext } from './static-graphics-context';
import { environment } from '../../../environments/environment';

/**
 * Supersampling factor for the disc tessellation. PixiJS bakes a circle's
 * segment count once from its local radius (`n ≈ 2.3·√r`), and at 0.5 grid
 * units that is a visibly faceted ~12-gon. Drawing SCALE× larger with an equal
 * counter-scale in the context tessellates from the large radius and scales
 * the baked points back down. `gridSize` cancels the grid scale exactly, so
 * the disc bakes at its zoom-1 pixel size: a ~40-gon, smooth to max zoom.
 */
const SCALE = environment.gridSize;

/**
 * An LED's body: a grid-cell-filling disc drawn white, so the lit state is a
 * pure tint. PixiJS patches a tint in place, so a blinking LED triggers no
 * redraw or context swap during simulation.
 */
export class LedGraphics extends StaticGraphicsContext {
  public static override readonly themeIndependent = true;

  constructor() {
    super();

    this.scale(1 / SCALE);
    this.circle(0.5 * SCALE, 0.5 * SCALE, 0.5 * SCALE);
    this.fill(0xffffff);
  }
}
