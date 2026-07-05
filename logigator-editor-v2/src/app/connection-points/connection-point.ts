import { Graphics, Point } from 'pixi.js';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import { ConnectionPointGraphics } from '../rendering/graphics/connection-point.graphics';
import { environment } from '../../environments/environment';

export class ConnectionPoint extends Graphics {
  // Connection points render at one of two fixed screen sizes: the smaller one
  // when zoomed well out, the larger one otherwise.
  public static readonly SCREEN_SIZE_PX_SMALL = 4;
  public static readonly SCREEN_SIZE_PX_LARGE = 6;
  public static readonly SIZE_THRESHOLD_SCALE = 0.5;

  private readonly _graphicsProviderService = getStaticDI(
    GraphicsProviderService
  );

  constructor(position: Point) {
    super();
    this.cullableChildren = false;
    this.context = this._graphicsProviderService.getGraphicsContext(
      ConnectionPointGraphics
    );
    this.position.copyFrom(position);
    // pivot at (0.5, 0.5) within the 1×1 unit square centres the dot on position
    this.pivot.set(0.5, 0.5);
  }

  // Screen size in pixels at the given zoom scale: small when well zoomed out,
  // large otherwise. Shared so other dots (e.g. the text anchor) render equal.
  public static screenSizePxForScale(scale: number): number {
    return scale < ConnectionPoint.SIZE_THRESHOLD_SCALE
      ? ConnectionPoint.SCREEN_SIZE_PX_SMALL
      : ConnectionPoint.SCREEN_SIZE_PX_LARGE;
  }

  public applyScale(scale: number): void {
    const sizeInGridUnits =
      ConnectionPoint.screenSizePxForScale(scale) /
      (scale * environment.gridSize);
    this.scale.set(sizeInGridUnits);
  }
}
