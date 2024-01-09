import { Injectable } from '@angular/core';
import { Graphics, GraphicsGeometry } from 'pixi.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheableGraphics = new (...args: any[]) => Graphics;

@Injectable({
	providedIn: 'root'
})
export class GeometryService {
	private readonly _cache: Map<
		CacheableGraphics,
		Map<string, GraphicsGeometry>
	> = new Map();

	constructor() {}

	public getGeometry<T extends CacheableGraphics>(
		graphics: T,
		...params: ConstructorParameters<T>
	): GraphicsGeometry {
		const cachedGraphics = this._cache.get(graphics);

		if (!cachedGraphics) {
			const geometry = new graphics(...params).geometry;

			this._cache.set(graphics, new Map([[params.join(), geometry]]));

			return geometry;
		}

		const cachedGeometry = cachedGraphics.get(params.join());
		if (!cachedGeometry) {
			const geometry = new graphics(...params).geometry;

			cachedGraphics.set(params.join(), geometry);

			return geometry;
		}

		return cachedGeometry;
	}
}
