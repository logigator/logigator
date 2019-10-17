import {SimulationUnit} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';

type UnitToElement = Map<SimulationUnit, Element>;
type ElementToUnit = Map<Element, SimulationUnit>;
interface UnitElementBidir {
	unitToElement: UnitToElement;
	elementToUnit: ElementToUnit;
}
type Replacement = Map<number, number>;
type ReplacementById = Map<number, number[]>;
interface UdcInnerData {
	units: UnitToElement;
	replacements: Replacement;
}
type AbsPlugIdsOnLinks = Map<number, number[]>;
// type LinksOnWireEnds = Map<PIXI.Point[], number>;
type LinkOnWireEnd = Map<number, number>;
type WireEndLinksOnElem = Map<Element, LinkOnWireEnd>;
type WireEndOnElem = Map<Element, number>;
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
type WiresOnLinksInProject = Map<string, WiresOnLinks>;
interface WireEndOnComp {
	component: Element;
	wireIndex: number;
}
type WireEndsOnLinks = Map<number, WireEndOnComp[]>;
type WireEndsOnLinksInProject = Map<string, WireEndsOnLinks>;
// string looks like this: 'projId:compId-projId'

export {UnitToElement, UdcInnerData, AbsPlugIdsOnLinks,
	LinkOnWireEnd, CompPlugByIndex, Replacement,
	ConnectedToPlugByIndex, ReplacementById, PosOfElem, WireEndOnElem,
	WiresOnLinks, WiresOnLinksInProject, WireEndLinksOnElem,
	WireEndOnComp, WireEndsOnLinks, WireEndsOnLinksInProject,
	ElementToUnit, UnitElementBidir};
