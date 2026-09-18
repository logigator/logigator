import { inject, Injectable } from '@angular/core';
import { GraphicsContext } from 'pixi.js';
import { ThemingService } from '../theming/theming.service';
import { StaticGraphicsContext } from './graphics/static-graphics-context';

// Cached contexts are shared across many Graphics and live forever, the
// contract StaticGraphicsContext encodes; a plain one is not cacheable here.
type CacheableGraphics = (new (...args: never[]) => StaticGraphicsContext) &
  Pick<typeof StaticGraphicsContext, 'themeIndependent'>;

@Injectable({
  providedIn: 'root'
})
export class GraphicsProviderService {
  private readonly _themingService = inject(ThemingService);

  private readonly _cache = new Map<
    CacheableGraphics,
    Map<string, GraphicsContext>
  >();

  public getGraphicsContext<T extends CacheableGraphics>(
    graphics: T,
    ...params: ConstructorParameters<T>
  ): GraphicsContext {
    const cachedGraphics = this._cache.get(graphics);
    // Theme is part of the key: most graphics classes bake theme colors into
    // the context at construction, so each theme needs its own cached instance.
    // Theme-independent contexts (white base, colored via instance tint) share
    // one entry so every consumer batches on the same context across themes.
    const themeKey = graphics.themeIndependent
      ? 'static'
      : this._themingService.currentThemeType();
    const paramsHash = `${themeKey}:${JSON.stringify(params)}`;

    if (!cachedGraphics) {
      const context = new graphics(...params);

      this._cache.set(graphics, new Map([[paramsHash, context]]));

      return context;
    }

    const cachedContext = cachedGraphics.get(paramsHash);
    if (!cachedContext) {
      const geometry = new graphics(...params);

      cachedGraphics.set(paramsHash, geometry);

      return geometry;
    }

    return cachedContext;
  }
}
