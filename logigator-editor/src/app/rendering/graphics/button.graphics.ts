import { StaticGraphicsContext } from './static-graphics-context';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/**
 * A button's body: a plain square outline, not the chamfered standard body,
 * with an inset circle that fills while the button is held.
 */
export class ButtonGraphics extends StaticGraphicsContext {
  constructor(scale: number, held: boolean) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    const inset = 3 * PX;

    this.rect(0, 0, 1, 1);
    this.fill(theme.background);
    this.stroke({ color: theme.wire, width: PX / scale });

    this.smoothCircle(0.5, 0.5, 0.5 - inset);
    if (held) {
      this.fill(theme.wire);
    }
    this.stroke({ color: theme.wire, width: PX / scale });
  }
}
