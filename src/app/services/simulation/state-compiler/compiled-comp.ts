import {WireEndsOnLinks, WiresOnLinks} from './compiler-types';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import {Element} from '../../../models/element';

export interface CompiledComp {
	units: Map<SimulationUnit, Element>;
	connectedPlugs: number[][];
	plugsByIndex: Map<number, number>; // outerUnit -> inner
	includesUdcs: Set<number>;
}
