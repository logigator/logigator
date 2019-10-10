import {SimulationUnit} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';

export interface CompiledComp {
	startId: number;
	units: Map<SimulationUnit, Element>;
	// linksOnUnits: Map<PIXI.Point[], number>;
	connectedToPlug: Map<number, {compIndex: number, wireIndex: number}[]>;
	plugToPlug: Map<number, {compIndex: number, wireIndex: number}[]>;
	// elemsAtPlug: Map<SimulationUnit, Element[]>;
}
