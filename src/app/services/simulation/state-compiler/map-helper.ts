import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';
import {LinksOnWireEnds, UnitToElement} from './compiler-types';

export abstract class MapHelper {

	public static mapHas(map: LinksOnWireEnds, points: PIXI.Point[]): boolean {
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

	public static mapGet(map: LinksOnWireEnds, points: PIXI.Point[]): number {
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

	public static valueToKey(map: UnitToElement, val: Element): SimulationUnit {
		return [...map.keys()].find(k => map.get(k) === val);
	}

	public static cloneMapSimUnits(map: UnitToElement): UnitToElement {
		const out = new Map<SimulationUnit, Element>();
		for (const [key, val] of map.entries()) {
			out.set(SimulationUnits.clone(key), val);
		}
		return out;
	}
}
