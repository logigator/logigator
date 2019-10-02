import {SimulationUnit} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';

export abstract class MapHeler {

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

	public static keyToValue(map: Map<SimulationUnit, Element>, val: Element): SimulationUnit {
		return [...map.keys()].find(k => map.get(k) === val);
	}
}
