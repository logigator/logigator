import { Graphics, Point } from 'pixi.js';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { ConnectionPointGraphics } from '../rendering/graphics/connection-point.graphics';
import { PX } from '../utils/grid';
import { clamp } from '../utils/math';

/** On-screen dot diameter at 100% zoom; scales with the board around here. */
export const DIAMETER = 6 * PX;
/** Smallest on-screen dot diameter; the floor when zoomed out. */
export const MIN_DIAMETER = 3 * PX;
/** Largest on-screen dot diameter; the ceiling when zoomed in. */
export const MAX_DIAMETER = 8 * PX;

// Grid-unit dot size, applied as the ConnectionPoint transform: DIAMETER across
// (so it scales with the board), clamped to a fixed pixel floor/ceiling on
// screen — the `/ scale` on the bounds counter-scales the zoom.
export function scaleForScale(scale: number): number {
  return clamp(DIAMETER, MIN_DIAMETER / scale, MAX_DIAMETER / scale);
}

export class ConnectionPoint extends Graphics {
  private readonly _graphicsProviderService = getStaticDI(
    GraphicsProviderService
  );

  constructor(position: Point) {
    super();
    this.context = this._graphicsProviderService.getGraphicsContext(
      ConnectionPointGraphics
    );
    this.position.copyFrom(position);
    // pivot at (0.5, 0.5) within the 1×1 unit square centres the dot on position
    this.pivot.set(0.5, 0.5);
  }

  public applyScale(scale: number): void {
    this.scale.set(scaleForScale(scale));
  }

  /**
   * Re-fetches the dot's context after a theme change. The cache is
   * theme-keyed, so this returns a freshly-colored context; the instance's
   * selection tint and scale carry over untouched.
   */
  public refreshTheme(): void {
    this.context = this._graphicsProviderService.getGraphicsContext(
      ConnectionPointGraphics
    );
  }
}
