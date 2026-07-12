import { GraphicsContext } from 'pixi.js';

/**
 * Events that carry no information on a static context: `update` fires only
 * on a post-bake mutation and `unload` only from the renderer's GC, and the
 * class rules out both.
 */
const DROPPED_EVENTS: ReadonlySet<string | symbol> = new Set([
  'update',
  'unload'
]);

/**
 * Base class for the shared contexts cached by `GraphicsProviderService`:
 * baked once in the constructor, immutable afterwards.
 *
 * Immutability makes the `update`/`unload` subscriptions every attached
 * Graphics holds pure dead weight, so `on`/`once` drop them. This keeps the
 * listener lists empty, making a context swap (`graphics.context = other`)
 * O(1) per Graphics — with listeners present, eventemitter3's removeListener
 * rebuilds the whole listener array, so re-pointing the thousands of Graphics
 * of a big board on every zoom step degrades quadratically.
 */
export class StaticGraphicsContext extends GraphicsContext {
  /**
   * Contexts that bake no theme colors (white-base geometry colored via
   * per-instance tint) share one cache entry across themes — the provider
   * drops the theme from their cache key.
   */
  public static readonly themeIndependent: boolean = false;

  constructor() {
    super();
    // Opting out of the renderer's GC guarantees `unload` can never fire:
    // attached Graphics keep clones of the baked batches and, with the
    // subscription dropped, would never learn about a reclaim. The GPU data
    // simply lives as long as the context itself (the provider never evicts).
    this.autoGarbageCollect = false;
  }

  public override on(...args: Parameters<GraphicsContext['on']>): this {
    return DROPPED_EVENTS.has(args[0]) ? this : super.on(...args);
  }

  public override once(...args: Parameters<GraphicsContext['once']>): this {
    return DROPPED_EVENTS.has(args[0]) ? this : super.once(...args);
  }
}
