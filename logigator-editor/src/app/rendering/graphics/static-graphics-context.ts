import { GraphicsContext } from 'pixi.js';
import { environment } from '../../../environments/environment';

/**
 * Supersampling factor for {@link StaticGraphicsContext.smoothCircle}. It
 * cancels the grid scale exactly, so a grid-unit circle tessellates from its
 * zoom-1 pixel radius.
 */
const CIRCLE_SUPERSAMPLE = environment.gridSize;

/** `update` needs a post-bake mutation and `unload` the GC; neither happens. */
const DROPPED_EVENTS: ReadonlySet<string | symbol> = new Set([
  'update',
  'unload'
]);

/**
 * Base class for the shared contexts cached by `GraphicsProviderService`:
 * baked once in the constructor, immutable afterwards.
 *
 * Immutability makes every attached Graphics' `update`/`unload` subscription
 * dead weight, so `on`/`once` drop them. Empty listener lists keep a context
 * swap O(1) per Graphics: eventemitter3's removeListener rebuilds the whole
 * array, so re-pointing a big board's Graphics on each zoom step would
 * degrade quadratically.
 */
export class StaticGraphicsContext extends GraphicsContext {
  /**
   * Contexts baking no theme colors (white-base geometry tinted per instance)
   * share one cache entry: the provider drops the theme from their key.
   */
  public static readonly themeIndependent: boolean = false;

  constructor() {
    super();
    // Opting out of the GC guarantees `unload` can never fire: attached
    // Graphics keep clones of the baked batches and, with the subscription
    // dropped, would never learn about a reclaim. The GPU data lives as long
    // as the context (the provider never evicts).
    this.autoGarbageCollect = false;
  }

  /**
   * A circle whose tessellation holds up at every zoom. PixiJS bakes a
   * circle's segment count once from its local radius (`4·⌈2.3·√(2r)⌉`
   * vertices), and at the sub-unit radii of grid-space geometry that is an
   * 8- to 12-gon. Drawing the circle `CIRCLE_SUPERSAMPLE`× larger under an equal
   * counter-scale tessellates it from the large radius and scales the baked
   * points back down, so the disc bakes as it measures on screen at zoom 1.
   * The counter-scale is scoped to this one shape; a stroke's width is applied
   * after the transform and is unaffected.
   */
  protected smoothCircle(x: number, y: number, radius: number): this {
    return this.save()
      .scale(1 / CIRCLE_SUPERSAMPLE)
      .circle(
        x * CIRCLE_SUPERSAMPLE,
        y * CIRCLE_SUPERSAMPLE,
        radius * CIRCLE_SUPERSAMPLE
      )
      .restore();
  }

  public override on(...args: Parameters<GraphicsContext['on']>): this {
    return DROPPED_EVENTS.has(args[0]) ? this : super.on(...args);
  }

  public override once(...args: Parameters<GraphicsContext['once']>): this {
    return DROPPED_EVENTS.has(args[0]) ? this : super.once(...args);
  }
}
