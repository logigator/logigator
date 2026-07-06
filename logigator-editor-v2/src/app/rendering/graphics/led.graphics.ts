import { GraphicsContext } from 'pixi.js';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** An LED's body: a grid-cell-filling disc, tinted by its lit state. */
export class LedGraphics extends GraphicsContext {
  constructor(lit: boolean) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();

    this.circle(0.5, 0.5, 0.5);
    this.fill(lit ? theme.ledOn : theme.ledOff);
  }
}
