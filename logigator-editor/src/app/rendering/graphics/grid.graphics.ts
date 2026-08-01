import { StaticGraphicsContext } from './static-graphics-context';
import { fromGrid } from '../../utils/grid';
import { environment } from '../../../environments/environment';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

export class GridGraphics extends StaticGraphicsContext {
  constructor(size: number, scale: number) {
    super();

    const themingService = getStaticDI(ThemingService);
    const sizePx = fromGrid(size);

    // Dots sit at cell centres — the half-grid lattice wire endpoints, port
    // tips, and junctions terminate on — so the visible grid marks exactly
    // where elements connect. One dot per cell, strictly interior to the
    // chunk, so edge-to-edge chunk tiling never doubles up seam dots.
    //
    // Each dot covers the exact pixels a wire crossing its lattice point
    // covers: a horizontal wire carries its thickness below the lattice line,
    // while a vertical wire (the same unit rect rotated 90°) carries it to
    // the left — so the dot extends down in y but left in x. Dot size and
    // wire thickness are both 1/scale, keeping the match at every zoom.
    const half = environment.gridSize / 2;
    for (let x = 0; x < sizePx; x += environment.gridSize) {
      for (let y = 0; y < sizePx; y += environment.gridSize) {
        this.rect(x + half - 1 / scale, y + half, 1 / scale, 1 / scale);
      }
    }
    this.fill({
      color: themingService.currentTheme().wire,
      alpha: scale < 0.25 ? 0.5 : 1
    });

    if (environment.debug.showGridBorders) {
      this.rect(0, 0, sizePx, sizePx);
      this.stroke({
        color: 0xff0000,
        alpha: 0.2,
        width: 1 / scale
      });
    }
  }
}
