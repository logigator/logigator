import { inject, Injectable } from '@angular/core';
import { GraphicsContext } from 'pixi.js';
import { ThemingService } from '../theming/theming.service';

type CacheableGraphics = new (...args: never[]) => GraphicsContext;

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
    // Theme is part of the key: the graphics classes bake theme colors into the
    // context at construction, so each theme needs its own cached instance.
    const paramsHash = `${this._themingService.currentThemeType()}:${JSON.stringify(params)}`;

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
