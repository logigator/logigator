import { GraphicsContext } from 'pixi.js';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** Thickness of a powered wire/stub during simulation (unpowered = 1). */
export const POWERED_WIRE_THICKNESS = 3;

export class WireGraphics extends GraphicsContext {
  constructor(thickness = 1) {
    super();

    const themingService = getStaticDI(ThemingService);
    // Extra thickness extends symmetrically around the wire centre-line (the
    // 1×1 rect of the default thickness is the alignment reference).
    this.rect(0, -(thickness - 1) / 2, 1, thickness);
    this.fill(themingService.currentTheme().wire);
  }
}
