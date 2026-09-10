import { Point, PointData } from 'pixi.js';
import { environment } from '../../../environments/environment';

/**
 * One normalized pointer sample. Both points are freshly allocated per DOM
 * event, so receivers may mutate them.
 */
export interface PointerInput {
  readonly pointerId: number;
  readonly pointerType: string;
  /** Canvas-local CSS pixels: the space `Project.pan`/`zoomBy` expect. */
  readonly global: Point;
  /** The same position in the project's grid coordinates. */
  readonly grid: Point;
}

/**
 * Grid-space position of a canvas-local point under a viewport transform.
 * Reads `position`/`scale` rather than `worldTransform`, which only updates
 * when a frame is drawn. Valid because a `Project` always sits at the stage
 * root with the backing store at CSS-pixel resolution.
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
