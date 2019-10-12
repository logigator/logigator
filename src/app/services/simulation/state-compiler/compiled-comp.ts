import {SimulationUnit} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';

export interface CompiledComp {
	startId: number;
	units: Map<SimulationUnit, Element>;
	connectedToPlug: Map<number, {compIndex: number, wireIndex: number}[]>;
	replacements: Map<number, number[]>;
}
