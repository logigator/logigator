import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';

export abstract class MapHelper {

	public static mapHas(map: Map<PIXI.Point[], number>, points: PIXI.Point[]): boolean {
		outer: for (const key of map.keys()) {
			for (const point of key) {
				if (!points.find(p => p.equals(point))) {
					continue outer;
				}
			}
			return true;
		}
		return false;
	}

	public static mapGet(map: Map<PIXI.Point[], number>, points: PIXI.Point[]): number {
		outer: for (const key of map.keys()) {
			for (const point of key) {
				if (!points.find(p => p.equals(point))) {
					continue outer;
				}
			}
			return map.get(key);
		}
		return undefined;
	}

	public static valueToKey(map: Map<SimulationUnit, Element>, val: Element): SimulationUnit {
		return [...map.keys()].find(k => map.get(k) === val);
	}

	public static cloneMapSimUnits(map: Map<SimulationUnit, Element>): Map<SimulationUnit, Element> {
		const out = new Map<SimulationUnit, Element>();
		for (const [key, val] of map.entries()) {
			out.set(SimulationUnits.clone(key), val);
		}
		return out;
	}

	public static cloneMap<K, V>(map: Map<K, V>): Map<K, V> {
		const out = new Map<K, V>();
		for (const [key, val] of map.entries()) {
			out.set(key, val);
		}
		return out;
	}

	public static replaceAll(map: Map<number, number>, from: number, to: number): void {
		for (let [key, val] of map.entries()) {
			if (key === from)
				key = to;
			if (val === from)
				val = to;
		}
	}
}
