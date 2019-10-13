import {SimulationUnit} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';

type UnitToElement = Map<SimulationUnit, Element>;
type Replacement = Map<number, number>;
type ReplacementById = Map<number, number[]>;
interface UdcInnerData {
	units: UnitToElement;
	replacements: Replacement;
}
type AbsPlugIdsOnLinks = Map<number, number[]>;
type LinksOnWireEnds = Map<PIXI.Point[], number>;
interface CompPlugByIndex {
	compIndex: number;
	wireIndex: number;
}
type ConnectedToPlugByIndex = Map<number, CompPlugByIndex[]>;

export {UnitToElement, UdcInnerData, AbsPlugIdsOnLinks,
	LinksOnWireEnds, CompPlugByIndex, Replacement,
	ConnectedToPlugByIndex, ReplacementById};
