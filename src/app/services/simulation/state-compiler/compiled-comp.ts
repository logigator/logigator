import {UnitElementBidir, WireEndsOnLinks, WiresOnLinks} from './compiler-types';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import {Element} from '../../../models/element';

export interface CompiledComp {
	unitElems: UnitElementBidir;
	wiresOnLinks: WiresOnLinks;
	wireEndsOnLinks: WireEndsOnLinks;
	connectedPlugs: number[][];
	plugsByIndex: Map<number, number>; // outerUnit -> inner
}
