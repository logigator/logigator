import { Container, Graphics, Point, Rectangle } from 'pixi.js';
import { GridGraphics } from './graphics/grid.graphics';
import { GraphicsProviderService } from './graphics-provider.service';
import { fromGrid } from '../utils/grid';
import { getStaticDI } from '../utils/get-di';

export class Grid extends Container {
  override sortableChildren = false;

  private readonly _geometryService = getStaticDI(GraphicsProviderService);
  private readonly _chunkSize = 32;
  private readonly _chunkSizePx = fromGrid(this._chunkSize);
  private _elScale = 1;
  private _viewportSize: Point = new Point(0, 0);
  private _elPosition = new Point(0, 0);

  constructor() {
    // Its own render group: every zoom step swaps each chunk's context to the
    // new scale's geometry, and PixiJS answers any view update inside a group
    // by rebuilding that group's whole instruction set. In the root group that
    // re-collects the entire scene outside the nested entry groups; here it
    // re-collects the grid alone. Chunks carry ~1k rects each, past the
    // batchable vertex limit, so they were never batching with content anyway
    // and the group boundary costs no draw calls.
    super({ isRenderGroup: true });

    this.boundsArea = new Rectangle(
      -Number.MAX_VALUE / 2,
      -Number.MAX_VALUE / 2,
      Number.MAX_VALUE,
      Number.MAX_VALUE
    );
    this.hitArea = this.boundsArea;

    this.pivot.set(this._chunkSizePx);
    this.draw();
  }

  public updatePosition(position: Point) {
    this._elPosition.set(position.x, position.y);
    this.position.set(
      -this.chunkAligned(position.x / this._elScale),
      -this.chunkAligned(position.y / this._elScale)
    );
  }

  public resizeViewport(viewport: Point) {
    this._viewportSize.set(viewport.x, viewport.y);
    this.draw();
  }

  /**
   * Re-runs draw() so each chunk picks up a freshly-built GridGraphics context.
   * Used on theme change: the cache is theme-keyed, so getGraphicsContext now
   * returns a new context and the `child.context !== geometry` swap repaints.
   */
  public redraw(): void {
    this.draw();
  }

  public updateScale(scale: number) {
    // Chunks are reused across scales — draw() swaps each one's context to the
    // new-scale geometry rather than destroying and recreating the whole set.
    this._elScale = scale;
    this.updatePosition(this._elPosition);
    this.draw();
  }

  private draw(): void {
    const geometry = this._geometryService.getGraphicsContext(
      GridGraphics,
      this._chunkSize,
      this._elScale
    );

    const viewportScaled = new Point(
      this._viewportSize.x / this._elScale + this._chunkSizePx,
      this._viewportSize.y / this._elScale + this._chunkSizePx
    );

    let i = 0;
    for (let x = 0; x <= viewportScaled.x; x += this._chunkSizePx) {
      for (let y = 0; y <= viewportScaled.y; y += this._chunkSizePx, ++i) {
        let child = this.children[i] as Graphics | undefined;
        if (!child) {
          child = new Graphics(geometry);
          this.addChild(child);
        } else if (child.context !== geometry) {
          // Reused from a previous scale: swap to the current-scale geometry.
          // Pure pan/resize keeps the same context, so this is a no-op then.
          child.context = geometry;
        }
        child.position.set(x, y);
      }
    }

    if (i < this.children.length) {
      // Detach the surplus in one splice, then destroy what came back:
      // destroy() removes the child from its parent, so destroying inside a
      // loop over `children` shrinks the array being iterated. The guard is
      // load-bearing — removeChildren over an empty range of a non-empty
      // container throws a RangeError.
      for (const child of this.removeChildren(i)) {
        child.destroy();
      }
    }
  }

  private chunkAligned(num: number): number {
    return Math.floor(num / this._chunkSizePx) * this._chunkSizePx;
  }
}
