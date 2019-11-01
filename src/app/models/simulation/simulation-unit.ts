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

	public static clone(unit: SimulationUnit): SimulationUnit {
		return {
			typeId: unit.typeId,
			inputs: [...unit.inputs],
			outputs: [...unit.outputs]
		};
	}

	public static cloneMult(units: SimulationUnit[]): SimulationUnit[] {
		const out = new Array(units.length);
		for (let i = 0; i < units.length; i++) {
			out[i] = SimulationUnits.clone(units[i]);
		}
		return out;
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
