import { StaticGraphicsContext } from './static-graphics-context';

/**
 * An LED's body: a grid-cell-filling disc drawn white, so the lit state is a
 * pure tint. PixiJS patches a tint in place, so a blinking LED triggers no
 * redraw or context swap during simulation.
 */
export class LedGraphics extends StaticGraphicsContext {
  public static override readonly themeIndependent = true;

  constructor() {
    super();

    this.smoothCircle(0.5, 0.5, 0.5);
    this.fill(0xffffff);
  }
}
