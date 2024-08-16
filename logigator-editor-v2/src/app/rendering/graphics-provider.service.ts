import { Injectable } from '@angular/core';
import { GraphicsContext } from 'pixi.js';

type CacheableGraphics = new (...args: never[]) => GraphicsContext;

@Injectable({
	providedIn: 'root'
})
export class GraphicsProviderService {
	private readonly _cache: Map<
		CacheableGraphics,
		Map<string, GraphicsContext>
	> = new Map();

	constructor() {}

	public getGraphicsContext<T extends CacheableGraphics>(
		graphics: T,
		...params: ConstructorParameters<T>
	): GraphicsContext {
		const cachedGraphics = this._cache.get(graphics);
		const paramsHash = params.join();

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
