import {Injectable} from '@angular/core';
import {ProjectState} from '../../../models/project-state';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
import {Element, Elements} from '../../../models/element';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {ProjectsService} from '../../projects/projects.service';

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

	// TODO check for recursion: userDefComp cannot include itself
	public compile(state: ProjectState): SimulationUnit[] {
		const simulationUnits: Map<SimulationUnit, Element> = new Map<SimulationUnit, Element>();
		for (const element of state.allElements) {
			const unit = SimulationUnits.fromElement(element);
			if (unit) {
				simulationUnits.set(unit, element);
			}
		}
		this.setUnitsInterfaces(state, simulationUnits);
		// this.dissolveUserDefined(simulationUnits, state.highestTakenId);
		return [...simulationUnits.keys()];
	}

	private setUnitsInterfaces(state: ProjectState, units: Map<SimulationUnit, Element>): void {
		let highestLinkId = 0;
		const unitsOnLinks: Map<PIXI.Point[], number> = new Map<PIXI.Point[], number>();
		for (const unit of units.keys()) {
			const element = units.get(unit);
			let wireEndIndex = 0;
			for (const wireEndPos of Elements.wireEnds(element)) {
				// TODO output gets covered by opposites inputs
				const connected = this.connectedToPos(state, wireEndPos, []);
				const linkId = this.mapHas(unitsOnLinks, connected)
					? this.mapGet(unitsOnLinks, connected)
					: ++highestLinkId;
				unitsOnLinks.set(connected, linkId);
				if (Elements.isInput(element, wireEndPos)) {
					unit.inputs[wireEndIndex] = linkId;
				} else {
					unit.outputs[wireEndIndex - element.numInputs] = linkId;
				}
				wireEndIndex++;
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

	private mapHas(map: Map<PIXI.Point[], number>, points: PIXI.Point[]): boolean {
		outer: for (const key of map.keys()) {
			for (const point of key) {
				if (!points.find(p => p.equals(point))) {
					continue outer;
				}
			}
			return true;
		}
		return false;
	}

	private mapGet(map: Map<PIXI.Point[], number>, points: PIXI.Point[]): number {
		outer: for (const key of map.keys()) {
			for (const point of key) {
				if (!points.find(p => p.equals(point))) {
					continue outer;
				}
			}
			return map.get(key);
		}
		return undefined;
	}



	// TODO test
	private dissolveUserDefined(userDefUnits: SimulationUnit[], highestId: number): number {
		for (const userDefUnit of userDefUnits) {
			if (this.elementProvider.getElementById(userDefUnit.typeId).category !== 'user')
				return;
			const unitsState = this.projects.getProjectById(userDefUnit.typeId).currState;
			const units = this.compile(unitsState);
			for (const unit of units) {
				// unit.id = ++highestId;

			}
		}
		return highestId;
	}

	// private isInputPlug(units: SimulationUnit[], id: number): boolean {
	// 	return this.elementProvider.getElementById(units.find(u => u.id === id).typeId).name === 'Input Plug';
	// }
	//
	// private isOutputPlug(units: SimulationUnit[], id: number): boolean {
	// 	return this.elementProvider.getElementById(units.find(u => u.id === id).typeId).name === 'Output Plug';
	// }
}
