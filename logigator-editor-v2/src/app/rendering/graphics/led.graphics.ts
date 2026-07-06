import { GraphicsContext } from 'pixi.js';

/**
 * An LED's body: a grid-cell-filling disc, drawn white so the lit state is a
 * pure tint (white × tint = the exact theme color). Tint is a color-path
 * change PixiJS patches in place, so a blinking LED never triggers a redraw
 * or context swap during simulation (see WireGraphics).
 */
export class LedGraphics extends GraphicsContext {
  constructor() {
    super();

    this.circle(0.5, 0.5, 0.5);
    this.fill(0xffffff);
  }
}
