import { StaticGraphicsContext } from './static-graphics-context';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/**
 * A button's full body (legacy look): a plain square outline — not the
 * chamfered standard body — with an inset inner square that fills with the
 * wire color while the button is pressed.
 */
export class ButtonGraphics extends StaticGraphicsContext {
  constructor(scale: number, pressed: boolean) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    const inset = 3 * PX;

    this.rect(0, 0, 1, 1);
    this.fill(theme.background);
    this.stroke({ color: theme.wire, width: PX / scale });

    this.rect(inset, inset, 1 - 2 * inset, 1 - 2 * inset);
    if (pressed) {
      this.fill(theme.wire);
    }
    this.stroke({ color: theme.wire, width: PX / scale });
  }
}
