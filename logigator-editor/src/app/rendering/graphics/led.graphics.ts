import { StaticGraphicsContext } from './static-graphics-context';
import { environment } from '../../../environments/environment';

/**
 * Supersampling factor for the disc tessellation. PixiJS bakes a circle's
 * segment count from its *local* radius (`n ≈ 2.3·√r`), once, at build time.
 * At the disc's true radius of 0.5 grid units that is a ~12-gon, which the
 * grid scale and viewport zoom blow up into visibly faceted edges. Drawing the
 * circle SCALE× larger and pre-multiplying an equal counter-scale into the
 * context lets `buildCircle` tessellate from the large radius, then
 * `transformVertices` scales the baked points back to the 0.5-unit disc — so
 * the geometry stays a single, immutable, smooth bake at any zoom.
 *
 * `gridSize` is the natural choice: the counter-scale then cancels the grid
 * scale exactly (mirroring `_visualSpace`'s `1 / gridSize`), so the disc is
 * baked at its zoom-1 pixel size — a ~40-gon, sub-pixel-smooth to max zoom.
 */
const SCALE = environment.gridSize;

/**
 * An LED's body: a grid-cell-filling disc, drawn white so the lit state is a
 * pure tint (white × tint = the exact theme color). Tint is a color-path
 * change PixiJS patches in place, so a blinking LED never triggers a redraw
 * or context swap during simulation (see WireGraphics).
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
