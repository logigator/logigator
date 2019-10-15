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
interface PosOfElem {
	id: number;
	pos: PIXI.Point;
}

type WiresOnLinks = Map<number, Element[]>;
type WiresOnLinksInProject = Map<number, WiresOnLinks>;
interface WireEndOnComp {
	component: Element;
	wireIndex: number;
}
type WireEndsOnLinks = Map<number, WireEndOnComp[]>;
type WireEndsOnLinksInProject = Map<number, WireEndsOnLinks>;

export {UnitToElement, UdcInnerData, AbsPlugIdsOnLinks,
	LinksOnWireEnds, CompPlugByIndex, Replacement,
	ConnectedToPlugByIndex, ReplacementById, PosOfElem,
	WiresOnLinks, WiresOnLinksInProject,
	WireEndOnComp, WireEndsOnLinks, WireEndsOnLinksInProject};
