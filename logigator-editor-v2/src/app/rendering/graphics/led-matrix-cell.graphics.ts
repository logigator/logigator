import { StaticGraphicsContext } from './static-graphics-context';

/**
 * One LED-matrix cell: a white unit square shared by every cell — each cell's
 * `Graphics` tints it to the theme's on/off LED color, so state changes are a
 * tint write instead of a context swap.
 */
export class LedMatrixCellGraphics extends StaticGraphicsContext {
  constructor() {
    super();

    this.rect(0, 0, 1, 1);
    this.fill(0xffffff);
  }
}
