import { ContainerChild, Point, Rectangle } from 'pixi.js';

export interface GridElement extends ContainerChild {
  readonly gridBounds: Rectangle;
  /**
   * `gridBounds.intersects(rect)` without materializing the rect. The quad
   * tree runs this once per candidate on every spatial query, where a fresh
   * Rectangle per element dominates a board-wide scan.
   */
  intersectsGridBounds(rect: Rectangle): boolean;
  // Bounds the quad tree files and culls by. An element whose rendered extent
  // exceeds its grid footprint (a text label) widens this so a pan does not
  // cull pixels still on screen. Spatial queries keep the tight gridBounds.
  readonly cullBounds: Rectangle;
  /**
   * Re-tunes every visual whose on-screen size must stay constant across zoom
   * to `scale`. The quad tree owns when this runs: on-screen entries stay at
   * the live zoom, off-screen ones lag until the cull pass returns them.
   */
  applyScale(scale: number): void;
}

export interface Connectable extends GridElement {
  readonly connectionPoints: Point[];
}
