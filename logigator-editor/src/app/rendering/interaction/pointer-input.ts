import { Point, PointData } from 'pixi.js';
import { environment } from '../../../environments/environment';

/**
 * One normalized pointer sample, dispatched by the {@link PointerController}.
 * Both points are freshly allocated per DOM event, so receivers may mutate
 * them (e.g. `roundToGrid(input.grid, true)`).
 */
export interface PointerInput {
  readonly pointerId: number;
  readonly pointerType: string;
  /**
   * Canvas-local CSS pixels — the space `Project.pan`/`zoomBy` expect (the
   * project's viewport transform maps it to the stage).
   */
  readonly global: Point;
  /** The same position in the project's grid coordinates. */
  readonly grid: Point;
}

/**
 * Grid-space position of a canvas-local point under the given viewport
 * transform. Reads `position`/`scale` directly — fresh even before the next
 * render, unlike `worldTransform`, which only updates when a frame is drawn.
 * Valid because a `Project` always sits at the stage root with the canvas
 * backing store at CSS-pixel resolution (`autoDensity` on the board, the
 * watch renderer's root projection).
 */
export function canvasToGrid(
  viewport: { position: PointData; scale: PointData },
  point: PointData
): Point {
  const factor = viewport.scale.x * environment.gridSize;
  return new Point(
    (point.x - viewport.position.x) / factor,
    (point.y - viewport.position.y) / factor
  );
}
