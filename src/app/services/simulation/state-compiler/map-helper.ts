import {CompiledComp} from './compiled-comp';

export abstract class MapHelper {

	public static pushInMapArray<K, V>(map: Map<K, Array<V>>, key: K, value: V): void {
		if (map.has(key)) {
			map.get(key).push(value);
		} else {
			map.set(key, [value]);
		}
	}

	public static pushInMapArrayUnique<K, V>(map: Map<K, Array<V>>, key: K, value: V): void {
		if (map.has(key)) {
			if (!map.get(key).includes(value))
				map.get(key).push(value);
		} else {
			map.set(key, [value]);
		}
	}

	public static uniquify(compiledComp: CompiledComp): void {
		for (const key of compiledComp.wiresOnLinks.keys()) {
			compiledComp.wiresOnLinks.set(key, [...new Set(compiledComp.wiresOnLinks.get(key)).values()]);
		}
	}

	public static array2dSame(a: number[][], b: number[][]): boolean {
		if (!a || !b)
			return false;
		if (a.length !== b.length)
			return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i].length !== b[i].length)
				return false;
			for (let j = 0; j < a[i].length; j++) {
				if (a[i][j] !== b[i][j])
					return false;
			}
		}
		return true;
	}
}
