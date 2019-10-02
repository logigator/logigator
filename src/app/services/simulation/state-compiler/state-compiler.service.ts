import {Injectable} from '@angular/core';
import {ProjectState} from '../../../models/project-state';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
import {Element, Elements} from '../../../models/element';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {ProjectsService} from '../../projects/projects.service';
import {MapHeler} from './map-heler';

@Injectable({
	providedIn: 'root'
})
export class StateCompilerService {

	public static staticInstance: StateCompilerService;

	constructor(
		private elementProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		StateCompilerService.staticInstance = this;
	}

	public compile(state: ProjectState): SimulationUnit[] {
		return [...this.compileInner(state).simUnits.keys()];
	}

	// TODO check for recursion: userDefComp cannot include itself
	private compileInner(state: ProjectState, lowestId?: number, plugLinks?: Map<number, number>):
		{simUnits: Map<SimulationUnit, Element>, replacements: Map<number, number>} {

		plugLinks = plugLinks || new Map<number, number>();
		const simulationUnits = this.generateUnits(state);
		const {highestLinkId, replacements} = this.setAllLinks(state, simulationUnits, lowestId, plugLinks);
		this.deletePlugElements(simulationUnits);
		this.dissolveUserDefined(simulationUnits, highestLinkId + 1);
		return {simUnits: simulationUnits, replacements};
	}

	private generateUnits(state: ProjectState) {
		const simulationUnits: Map<SimulationUnit, Element> = new Map<SimulationUnit, Element>();
		for (const element of state.allElements) {
			const unit = SimulationUnits.fromElement(element);
			if (unit) {
				simulationUnits.set(unit, element);
			}
		}
		return simulationUnits;
	}

	private deletePlugElements(simulationUnits) {
		for (const simUnit of simulationUnits.keys()) {
			if (this.elementProvider.isPlugElement(simUnit.typeId)) {
				simulationUnits.delete(simUnit);
			}
		}
	}

	private setAllLinks(
		state: ProjectState,
		units: Map<SimulationUnit, Element>,
		lowestId?: number,
		plugLinks?: Map<number, number>):
		{highestLinkId: number, replacements: Map<number, number>} {

		let highestLinkId = lowestId || 0;
		const unitsOnLinks: Map<PIXI.Point[], number> = new Map<PIXI.Point[], number>();
		const replacements = new Map<number, number>();

		this.fillPlugsInUnitsOnLinks(state, unitsOnLinks, units, plugLinks);

		for (const [unit, element] of units.entries()) {
			let wireEndIndex = 0;
			for (const wireEndPos of Elements.wireEnds(element)) {
				const connected = this.connectedToPos(state, wireEndPos, []);

				if (this.elementProvider.isPlugElement(unit.typeId)) {
					this.calcReplacements(unit, connected, state, element, units, replacements);
				} else {
					highestLinkId = this.setUnitLink(unitsOnLinks, connected, highestLinkId, element, wireEndPos, unit, wireEndIndex);
				}

				wireEndIndex++;
			}
		}

		return {highestLinkId, replacements};
	}

	private setUnitLink(unitsOnLinks: Map<PIXI.Point[], number>, connected, highestLinkId, element, wireEndPos, unit, wireEndIndex: number) {
		const linkId = MapHeler.mapHas(unitsOnLinks, connected)
			? MapHeler.mapGet(unitsOnLinks, connected)
			: ++highestLinkId;
		unitsOnLinks.set(connected, linkId);
		if (Elements.isInput(element, wireEndPos)) {
			unit.inputs[wireEndIndex] = linkId;
		} else {
			unit.outputs[wireEndIndex - element.numInputs] = linkId;
		}
		return highestLinkId;
	}

	private calcReplacements(unit, connected, state: ProjectState, element, units: Map<SimulationUnit, Element>, replacements) {
		const otherPlugs: Element[] = [];
		for (const pos of connected) {
			for (const elem of state.wireEndsOnPoint(pos)) {
				if (this.elementProvider.isPlugElement(elem.typeId) && elem.id !== element.id) {
					otherPlugs.push(elem);
				}
			}
		}
		for (const otherPlug of otherPlugs) {
			const u = MapHeler.keyToValue(units, otherPlug);
			replacements.set(unit.inputs.concat(unit.outputs)[0], u.inputs.concat(u.outputs)[0]);
		}
	}

	private fillPlugsInUnitsOnLinks(
		state: ProjectState,
		unitsOnLinks: Map<PIXI.Point[], number>,
		units: Map<SimulationUnit, Element>,
		plugLinks?: Map<number, number>): void {

		let plugIndex = 0;
		for (const [unit, element] of units.entries()) {
			if (!this.elementProvider.isPlugElement(unit.typeId))
				continue;
			for (const wireEndPos of Elements.wireEnds(element)) {
				const connected = this.connectedToPos(state, wireEndPos, []);
				const index = plugIndex++;
				unitsOnLinks.set(connected, plugLinks.get(index));
				unit.inputs = [plugLinks.get(index)];
				unit.outputs = [plugLinks.get(index)];
			}
		}
	}

	private connectedToPos(state: ProjectState, pos: PIXI.Point, coveredPoints?: {id: number, pos: PIXI.Point}[]): PIXI.Point[] {
		const connected: PIXI.Point[] = [];
		coveredPoints = coveredPoints || [];
		for (const elem of state.wireEndsOnPoint(pos)) {
			if (coveredPoints.find(p => p.id === elem.id && p.pos.equals(pos)))
				continue;
			this.pushIfNonExistent(coveredPoints, {id: elem.id, pos});
			if (elem.typeId !== 0) {
				this.pushIfNonExistent(connected, pos);
			} else {
				const oppoPos = this.otherPos(elem, pos);
				for (const otherPos of this.connectedToPos(state, oppoPos, coveredPoints)) {
					this.pushIfNonExistent(connected, otherPos);
				}
			}
		}
		return connected;
	}

	private otherPos(wire: Element, pos: PIXI.Point): PIXI.Point {
		return wire.pos.equals(pos) ? wire.endPos : wire.pos;
	}

	private pushIfNonExistent(numbers: any[], id: any) {
		if (!numbers.find(i => i === id || i.equals && i.equals(id)))
			numbers.push(id);
	}


	// TODO test
	private dissolveUserDefined(units: Map<SimulationUnit, Element>, lowestId: number) {
		const out = new Map<number, number>();
		for (const [unit, element] of units.entries()) {
			if (!this.elementProvider.isUserElement(unit.typeId))
				continue;
			this.dissolveSingle(units, unit, lowestId);
			units.delete(unit);
		}
		return out;
	}

	private dissolveSingle(units: Map<SimulationUnit, Element>, unit: SimulationUnit, lowestId: number) {
		const plugLinks: Map<number, number> = new Map<number, number>();
		let wireIndex = 0;
		for (const plugLink of unit.inputs.concat(unit.outputs)) {
			plugLinks.set(wireIndex++, plugLink);
		}
		const unitsState = this.projects.getProjectById(unit.typeId).currState;
		const {simUnits, replacements} = this.compileInner(unitsState, lowestId, plugLinks);
		simUnits.forEach((v, k) => {
			units.set(k, v);
		});
		this.doReplacements(units, replacements);
	}

	private doReplacements(units: Map<SimulationUnit, Element>, replacements) {
		for (const u of units.keys()) {
			for (const [from, to] of replacements) {
				[u.inputs, u.outputs].forEach(interfaces => {
					for (let i = 0; i < interfaces.length; i++)
						if (interfaces[i] === from)
							interfaces[i] = to;
				});
			}
		}
	}
}
