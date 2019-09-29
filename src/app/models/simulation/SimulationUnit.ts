import {Element} from '../element';

export interface SimulationUnit {
	id: number;
	typeId: number;
	inputs: number[];
	outputs: number[];
}

export abstract class SimulationUnits {

	public static fromElement(element: Element): SimulationUnit {
		return element.typeId === 0
			? undefined
			: {
				id: element.id,
				typeId: element.typeId,
				inputs: [],
				outputs: []
			};
	}
}
