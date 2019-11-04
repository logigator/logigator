import {CompiledComp} from './compiled-comp';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/simulation-unit';

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
}
