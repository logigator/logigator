import { GraphicsContext } from 'pixi.js';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/**
 * A switch's full body (legacy look): a plain square outline — not the
 * chamfered standard body — with a full-width slider bar. On: the bar sits at
 * the top, filled with the wire color. Off: it sits at the bottom as an empty
 * outline.
 */
export class SwitchGraphics extends GraphicsContext {
  constructor(scale: number, on: boolean) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    const barHeight = 4 * PX;

    this.rect(0, 0, 1, 1);
    this.fill(theme.background);
    this.stroke({ color: theme.wire, width: PX / scale });

    this.rect(0, on ? 0 : 1 - barHeight, 1, barHeight);
    if (on) {
      this.fill(theme.wire);
    }
    this.stroke({ color: theme.wire, width: PX / scale });
  }
}
