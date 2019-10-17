import {Element} from '../element';

export interface SimulationUnit {
	typeId: number;
	inputs: number[];
	outputs: number[];
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

	public static clone(unit: SimulationUnit): SimulationUnit {
		return {
			typeId: unit.typeId,
			inputs: [...unit.inputs],
			outputs: [...unit.outputs]
		};
	}

	public static concatIO(unit: SimulationUnit): number[] {
		return unit.inputs.concat(unit.outputs);
	}

	public static setInputOutput(unit: SimulationUnit, index: number, value: number): void {
		if (index < unit.inputs.length) {
			unit.inputs[index] = value;
		} else {
			unit.outputs[index - unit.inputs.length] = value;
		}
	}
}
