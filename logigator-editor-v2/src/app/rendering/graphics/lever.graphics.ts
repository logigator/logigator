import { GraphicsContext } from 'pixi.js';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** A lever's switch bar: drawn at the bottom while off, at the top while on. */
export class LeverGraphics extends GraphicsContext {
  constructor(on: boolean) {
    super();

    const themingService = getStaticDI(ThemingService);
    const barHeight = 4 * PX;

    this.rect(0, on ? 0 : 1 - barHeight, 1, barHeight);
    this.fill(themingService.currentTheme().wire);
  }
}
