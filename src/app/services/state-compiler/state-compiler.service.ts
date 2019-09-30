import {Injectable} from '@angular/core';
import {ProjectState} from '../../models/project-state';
import {SimulationUnit, SimulationUnits} from '../../models/simulation/SimulationUnit';
import {Element, Elements} from '../../models/element';

@Injectable({
	providedIn: 'root'
})
export class StateCompilerService {

	public static staticInstance: StateCompilerService;

	constructor() {
		StateCompilerService.staticInstance = this;
	}

	// TODO just starting, do not even know outputs structure
	public compile(state: ProjectState): SimulationUnit[] {
		const simulationUnits: SimulationUnit[] = [];
		for (const element of state.allElements) {
			const unit = SimulationUnits.fromElement(element);
			if (unit) {
				simulationUnits.push(unit);
				this.setUnitsInterfaces(state, element, unit);
			}
		}
		return simulationUnits;
	}

	private setUnitsInterfaces(state: ProjectState, element: Element, unit: SimulationUnit): void {
		for (const wireEndPos of Elements.wireEnds(element)) {
			// TODO output gets covered by opposites inputs
			if (Elements.isInput(element, wireEndPos)) {
				const connected = this.connectedToPos(state, wireEndPos, true, [unit.id]);
				for (const con of connected) {
					if (con !== unit.id)
						this.pushIfNonExistent(unit.inputs, con);
				}
			} else {
				const connected = this.connectedToPos(state, wireEndPos, false, [unit.id]);
				for (const con of connected) {
					if (con !== unit.id)
						this.pushIfNonExistent(unit.outputs, con);
				}
			}
		}
	}

	private connectedToPos(state: ProjectState, pos: PIXI.Point, isInput: boolean, coveredIds?: number[]): number[] {
		const connected: number[] = [];
		coveredIds = coveredIds || [];
		for (const elem of state.wireEndsOnPoint(pos)) {
			if (coveredIds.find(i => i === elem.id))
				continue;
			this.pushIfNonExistent(coveredIds, elem.id);
			if (elem.typeId !== 0) {
				if (Elements.isInput(elem, pos) && !isInput || !Elements.isInput(elem, pos) && isInput)
					this.pushIfNonExistent(connected, elem.id);
			} else {
				const otherPos = this.otherPos(elem, pos);
				for (const otherId of this.connectedToPos(state, otherPos, isInput, coveredIds)) {
					this.pushIfNonExistent(connected, otherId);
				}
			}
		}
		return connected;
	}

	private otherPos(wire: Element, pos: PIXI.Point): PIXI.Point {
		return wire.pos.equals(pos) ? wire.endPos : wire.pos;
	}

	private pushIfNonExistent(numbers: number[], id: number) {
		if (!numbers.find(i => i === id))
			numbers.push(id);
	}
}
