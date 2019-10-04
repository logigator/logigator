import {SimulationUnit} from '../../../models/simulation/SimulationUnit';
import {Element} from '../../../models/element';

export interface CompiledComp {
	startId: number;
	units: Map<SimulationUnit, Element>;
	linksOnUnits: Map<PIXI.Point[], number>;
	connectedToPlug: Map<SimulationUnit, {side: number[], index: number}[]>;
	// elemsAtPlug: Map<SimulationUnit, Element[]>;
}
