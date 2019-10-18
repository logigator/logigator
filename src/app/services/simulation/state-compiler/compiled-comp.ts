import {WireEndsOnLinks, WiresOnLinks} from './compiler-types';
import {SimulationUnit} from '../../../models/simulation/SimulationUnit';

export interface CompiledComp {
	units: SimulationUnit[];
	wiresOnLinks: WiresOnLinks;
	wireEndsOnLinks: WireEndsOnLinks;
	connectedPlugs: number[][];
	plugsByIndex: Map<number, number>; // outerUnit -> inner
	/*
	* [
	* 	[0, 1]
	* 	[0, 3]
	* ]
	*/
}
