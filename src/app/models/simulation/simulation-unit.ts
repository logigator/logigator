import {Element} from '../element';

export interface SimulationUnit {
	typeId: number;
	inputs: number[];
	outputs: number[];
	op1?: number;
	op2?: number;
}

export abstract class SimulationUnits {

	public static fromElement(element: Element): SimulationUnit {
		return element.typeId === 0
			? undefined
			: {
				typeId: element.typeId,
				inputs: new Array(element.numInputs),
				outputs: new Array(element.numOutputs)
			};
	}
}
