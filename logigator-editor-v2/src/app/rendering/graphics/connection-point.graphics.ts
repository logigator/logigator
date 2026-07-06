import { StaticGraphicsContext } from './static-graphics-context';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

export class ConnectionPointGraphics extends StaticGraphicsContext {
  constructor() {
    super();

    const themingService = getStaticDI(ThemingService);
    this.rect(0, 0, 1, 1);
    this.fill(themingService.currentTheme().wire);
  }
}
