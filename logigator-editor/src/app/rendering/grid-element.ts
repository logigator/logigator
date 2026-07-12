import { ContainerChild, Point, Rectangle } from 'pixi.js';

export interface GridElement extends ContainerChild {
  readonly gridBounds: Rectangle;
  // Bounds the quad tree files and culls by. Usually equal to gridBounds, but
  // an element whose rendered extent exceeds its logical grid footprint (e.g. a
  // text label) widens this so panning past the footprint does not cull pixels
  // still on screen. Spatial queries (selection, collision) keep using the tight
  // gridBounds.
  readonly cullBounds: Rectangle;
}

export interface Connectable extends GridElement {
  readonly connectionPoints: Point[];
}
