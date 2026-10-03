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

// Grid-unit dot size: DIAMETER across so it scales with the board, clamped to
// a fixed on-screen floor and ceiling by counter-scaling the bounds.
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
    // Centres the dot on position within the 1×1 unit square.
    this.pivot.set(0.5, 0.5);
  }

  public applyScale(scale: number): void {
    this.scale.set(scaleForScale(scale));
  }

  /** Whether the dot carries the selection color. */
  public get selected(): boolean {
    return this._selected;
  }

  public set selected(value: boolean) {
    this._selected = value;
    this.refreshTint();
  }

  /**
   * Re-derives the tint from theme and selection state. The shared context is a
   * white base, so the tint *is* the dot's color; also the theme-change hook.
   */
  public refreshTint(): void {
    const theme = this._themingService.currentTheme();
    this.tint = this._selected ? theme.wireSelectColor : theme.wire;
  }
}
