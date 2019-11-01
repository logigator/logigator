import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import {Element} from '../../../models/element';

type UnitToElement = Map<SimulationUnit, Element>;
type ElementToUnit = Map<Element, SimulationUnit>;
interface UnitElementBidir {
	unitToElement: UnitToElement;
	elementToUnit: ElementToUnit;
}
type LinkOnWireEnd = Map<number, number>;
type WireEndLinksOnElem = Map<Element, LinkOnWireEnd>;
type WireEndOnElem = Map<Element, number>;
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

export {UnitToElement, LinkOnWireEnd, PosOfElem, WireEndOnElem,
	WiresOnLinks, WiresOnLinksInProject, WireEndLinksOnElem,
	WireEndOnComp, WireEndsOnLinks, WireEndsOnLinksInProject,
	ElementToUnit, UnitElementBidir};
