import { GraphicsContext } from 'pixi.js';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** A button's inner square; filled while the button is pressed. */
export class ButtonGraphics extends GraphicsContext {
  constructor(scale: number, pressed: boolean) {
    super();

    const themingService = getStaticDI(ThemingService);
    const inset = 3 * PX;

    this.rect(inset, inset, 1 - 2 * inset, 1 - 2 * inset);
    if (pressed) {
      this.fill(themingService.currentTheme().wire);
    }
    this.stroke({
      color: themingService.currentTheme().wire,
      width: PX / scale
    });
  }
}
