import { ContainerChild, Point, Rectangle } from 'pixi.js';

export interface GridElement extends ContainerChild {
  readonly gridBounds: Rectangle;
  /**
   * Whether {@link gridBounds} overlaps `rect` — same answer as
   * `gridBounds.intersects(rect)`, without materializing the rect. The quad
   * tree runs this once per candidate on every spatial query, where deriving a
   * fresh Rectangle per element dominates the cost of a board-wide scan.
   * Implementations mirror their own `gridBounds`; see {@link overlapsRect}.
   */
  intersectsGridBounds(rect: Rectangle): boolean;
  // Bounds the quad tree files and culls by. Usually equal to gridBounds, but
  // an element whose rendered extent exceeds its logical grid footprint (e.g. a
  // text label) widens this so panning past the footprint does not cull pixels
  // still on screen. Spatial queries (selection, collision) keep using the tight
  // gridBounds.
  readonly cullBounds: Rectangle;
  /**
   * Re-tunes every visual whose on-screen size must stay constant across zoom
   * (stroke widths, port stubs, dots) to `scale`. The quad tree owns when this
   * runs: it keeps the elements of on-screen entries at the live zoom and lets
   * off-screen ones lag until the cull pass brings them back into view.
   */
  applyScale(scale: number): void;
}

export interface Connectable extends GridElement {
  readonly connectionPoints: Point[];
}
