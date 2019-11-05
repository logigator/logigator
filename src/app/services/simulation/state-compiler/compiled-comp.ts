import {WireEndsOnLinks, WiresOnLinks} from './compiler-types';
import {Element} from '../../../models/element';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';

export interface CompiledComp {
	units: Map<SimulationUnit, Element>;
	connectedPlugs: number[][];
	plugsByIndex: Map<number, number>; // outerUnit -> inner
	includesUdcs: Set<number>;
}
