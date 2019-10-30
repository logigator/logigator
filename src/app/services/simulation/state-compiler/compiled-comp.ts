import {UnitElementBidir, WireEndsOnLinks, WiresOnLinks} from './compiler-types';
import {Element} from '../../../models/element';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import {getStaticDI} from '../../../models/get-di';
import {ElementProviderService} from '../../element-provider/element-provider.service';

export interface CompiledComp {
	unitElems: UnitElementBidir; // saves all unit->elem but only IO-elem->unit
	wiresOnLinks: WiresOnLinks;
	wireEndsOnLinks: WireEndsOnLinks;
	connectedPlugs: number[][];
	plugsByIndex: Map<number, number>; // outerUnit -> inner
}

export abstract class CompiledComps {

	public static reduceToIO(unitElems: UnitElementBidir, compiledComp: CompiledComp) {
		const elementToUnit: Map<Element, SimulationUnit> = new Map<Element, SimulationUnit>();
		for (const [elem, unit] of unitElems.elementToUnit.entries()) {
			if (getStaticDI(ElementProviderService).isIoElement(unit.typeId)) {
				elementToUnit.set(elem, unit);
			}
		}
		compiledComp.unitElems.elementToUnit = elementToUnit;
	}
}
