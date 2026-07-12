import { Graphics, Point } from 'pixi.js';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { ConnectionPointGraphics } from '../rendering/graphics/connection-point.graphics';
import { ThemingService } from '../theming/theming.service';
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
  private readonly _themingService = getStaticDI(ThemingService);

  private _selected = false;

  constructor(position: Point) {
    super();
    this.context = this._graphicsProviderService.getGraphicsContext(
      ConnectionPointGraphics
    );
    this.refreshTint();
    this.position.copyFrom(position);
    // pivot at (0.5, 0.5) within the 1×1 unit square centres the dot on position
    this.pivot.set(0.5, 0.5);
  }

  public applyScale(scale: number): void {
    this.scale.set(scaleForScale(scale));
  }

  /** Whether the dot carries the selection color (see {@link refreshTint}). */
  public get selected(): boolean {
    return this._selected;
  }

  public set selected(value: boolean) {
    this._selected = value;
    this.refreshTint();
  }

  /**
   * Re-derives the tint from the current theme and selection state. The
   * shared context is a white base (see ConnectionPointGraphics), so the tint
   * IS the dot's color — this doubles as the theme-change hook.
   */
  public refreshTint(): void {
    const theme = this._themingService.currentTheme();
    this.tint = this._selected ? theme.wireSelectColor : theme.wire;
  }
}
