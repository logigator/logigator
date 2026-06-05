import { GraphicsContext } from 'pixi.js';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

export class ComponentGraphics extends GraphicsContext {
  constructor(width: number, height: number, scale: number) {
    super();

    const themingService = getStaticDI(ThemingService);
    const chamfer = 3 * PX;

    this.moveTo(0, 0);
    this.lineTo(width - chamfer, 0);
    this.lineTo(width, chamfer);
    this.lineTo(width, height - chamfer);
    this.lineTo(width - chamfer, height);
    this.lineTo(0, height);
    this.closePath();
    this.stroke({
      color: themingService.currentTheme().wire,
      width: (2 * PX) / scale
    });
    this.fill({
      color: themingService.currentTheme().background
    });
  }
}
