export class BiDirectionalMap<K, V> {
	private readonly map = new Map<K, V>();
	private readonly reverse = new Map<V, K>();

	constructor(map?: object | Map<K, V> | Array<[K, V]>) {
		if (!map) return;

		if (map instanceof Map) {
			map.forEach((value, key) => {
				this.set(key, value);
			});
		} else if (Array.isArray(map)) {
			map.forEach((entry) => {
				this.set(entry[0], entry[1]);
			});
		} else {
			Object.keys(map).forEach((key) => {
				this.set(key as K, map[key]);
			});
		}
	}

	get size(): number {
		return this.map.size;
	}

	public set(key: K, value: V): this {
		if (this.map.has(key)) {
			const existingValue = this.map.get(key);
			this.reverse.delete(existingValue);
		}

		if (this.reverse.has(value)) {
			const existingKey = this.reverse.get(value);
			this.map.delete(existingKey);
		}

		this.map.set(key, value);
		this.reverse.set(value, key);
		return this;
	}

	public clear(): void {
		this.map.clear();
		this.reverse.clear();
	}

	public getValue(key: K): V {
		return this.map.get(key);
	}

	public getKey(value: V): K {
		return this.reverse.get(value);
	}

	public deleteKey(key: K): boolean {
		const value = this.map.get(key);
		this.reverse.delete(value);
		return this.map.delete(key);
	}

	public deleteValue(value: V): boolean {
		const key = this.reverse.get(value);
		this.map.delete(key);
		return this.reverse.delete(value);
	}

	public hasKey(key: K): boolean {
		return this.map.has(key);
	}

	public hasValue(value): boolean {
		return this.reverse.has(value);
	}

	public keys(): IterableIterator<K> {
		return this.map.keys();
	}

	public values(): IterableIterator<V> {
		return this.reverse.keys();
	}

	public entries(): IterableIterator<[K, V]> {
		return this.map.entries();
	}

	public forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void {
		return this.map.forEach(callbackfn);
	}
}
