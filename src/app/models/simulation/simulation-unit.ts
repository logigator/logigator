import {Element} from '../element';
import {CompiledComp} from '../../services/simulation/state-compiler/compiled-comp';
import {ElementToUnit, UnitElementBidir, UnitToElement, WireEndLinksOnElem} from '../../services/simulation/state-compiler/compiler-types';
import {ProjectState} from '../project-state';

export interface SimulationUnit {
	typeId: number;
	inputs: number[];
	outputs: number[];
	op1?: number;
	op2?: number;
}

export abstract class SimulationUnits {

	public static generateUnits(state: ProjectState): UnitElementBidir {
		const unitToElement: UnitToElement = new Map<SimulationUnit, Element>();
		const elementToUnit: ElementToUnit = new Map<Element, SimulationUnit>();
		for (const element of state.model.values()) {
			const unit = SimulationUnits.fromElement(element);
			if (unit) {
				unitToElement.set(unit, element);
				elementToUnit.set(element, unit);
			}
		}
		return {unitToElement, elementToUnit};
	}

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

	public static wireIdHasLink(wireEndLinksOnElem: WireEndLinksOnElem, element: Element, wireIndex: number): boolean {
		return wireEndLinksOnElem.has(element) && wireEndLinksOnElem.get(element).has(wireIndex);
	}

	public static removePlugs(units: SimulationUnit[], compiledComp: CompiledComp) {
		const plugsByIndexSorted = [...compiledComp.plugsByIndex.values()].sort((a, b) => a - b);
		for (let i = plugsByIndexSorted.length - 1; i >= 0; i--) {
			units.splice(plugsByIndexSorted[i], 1);
		}
	}

	public static loadConnectedPlugs(compiledComp: CompiledComp) {
		const plugsByIndex = compiledComp.plugsByIndex;
		const plugsByIndexKeys = [...plugsByIndex.keys()];
		for (let i = 0; i < plugsByIndexKeys.length; i++) {
			const plugIndex = plugsByIndexKeys[i];
			const value = SimulationUnits.concatIO([...compiledComp.units.keys()][plugsByIndex.get(plugIndex)])[0];
			for (let j = i + 1; j < plugsByIndexKeys.length; j++) {
				const otherIndex = plugsByIndexKeys[j];
				const otherValue = SimulationUnits.concatIO([...compiledComp.units.keys()][plugsByIndex.get(otherIndex)])[0];
				if (value === otherValue) {
					let pushed = false;
					for (const arr of compiledComp.connectedPlugs) {
						if (arr.includes(plugIndex) && !arr.includes(otherIndex)) {
							arr.push(plugsByIndex.get(otherIndex));
							pushed = true;
						} else if (arr.includes(otherIndex) && !arr.includes(plugIndex)) {
							arr.push(plugsByIndex.get(plugIndex));
							pushed = true;
						} else if (arr.includes(otherIndex) && arr.includes(plugIndex)) {
							pushed = true;
						}
					}
					if (!pushed)
						compiledComp.connectedPlugs.push([plugIndex, otherIndex]);
				}
			}
		}
	}
}
