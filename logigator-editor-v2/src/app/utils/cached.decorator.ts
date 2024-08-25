/* eslint-disable @typescript-eslint/no-explicit-any */

export function Cached(keyGenerator?: () => string) {
	return function (
		target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor
	): PropertyDescriptor {
		const orig = descriptor.get;
		if (!orig) {
			return descriptor;
		}

		const cacheKey = Symbol(`cache_${propertyKey}`);
		target[cacheKey] = { key: null, val: null };

		descriptor.get = function () {
			let key = '';
			if (keyGenerator) {
				key = keyGenerator.apply(this);
			}

			// @ts-expect-error - this is not typed correctly
			const cache: { key: string; val: unknown } = this[cacheKey];

			if (cache.key !== key) {
				cache.key = key;
				cache.val = orig!.apply(this);
			}

			return cache.val;
		};

		return descriptor;
	};
}
