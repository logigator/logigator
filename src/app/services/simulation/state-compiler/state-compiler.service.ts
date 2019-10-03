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

	private _highestLinkId: number;
	private _udcCache: Map<ProjectState, {startId: number, units: Map<SimulationUnit, Element>}>;

	constructor(
		private elementProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		StateCompilerService.staticInstance = this;
	}

	public compile(state: ProjectState): SimulationUnit[] {
		this._udcCache = new Map<ProjectState, {startId: number, units: Map<SimulationUnit, Element>}>();
		this._highestLinkId = 0;
		return [...this.compileInner(state).simUnits.keys()];
	}

	// TODO check for recursion: userDefComp cannot include itself
	// private compileInner(state: ProjectState, plugLinks?: Map<number, number>):
	private compileInner(state: ProjectState, unit?: SimulationUnit):
		{simUnits: Map<SimulationUnit, Element>, replacements: Map<number, number>} {

		console.log('compInner', unit);
		// plugLinks = plugLinks || new Map<number, number>();
		let simulationUnits;
		if (this._udcCache.has(state)) {
			const {startId, units} = this._udcCache.get(state);
			this.setUdcCache(state, units, startId);
			simulationUnits = this._udcCache.get(state).units;
		} else {
			simulationUnits = this.generateUnits(state);
		}
		const replacements = this.setAllLinks(state, simulationUnits, unit);
		this.deletePlugElements(simulationUnits);
		this.dissolveUdcs(simulationUnits);
		return {simUnits: simulationUnits, replacements};
	}

	private setUdcCache(state: ProjectState, map: Map<SimulationUnit, Element>, startId: number): void {
		console.log('set cache startId', startId, map);
		this._udcCache.set(state, {startId, units: MapHeler.cloneMap(map)});
	}

	private generateUnits(state: ProjectState): Map<SimulationUnit, Element> {
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
		// plugLinks?: Map<number, number>): Map<number, number> {
		outerUnit?: SimulationUnit): Map<number, number> {

		const linksOnUnits: Map<PIXI.Point[], number> = new Map<PIXI.Point[], number>();
		const replacements = new Map<number, number>();

		this.fillPlugsInUnitsOnLinks(state, linksOnUnits, units, outerUnit);
		const startId = this._highestLinkId;
		let idsLoaded = false;

		if (this._udcCache.has(state)) {
			this.updateCachedIds(this._udcCache.get(state).startId, this._udcCache.get(state).units, linksOnUnits);
			idsLoaded = true;
		}


		for (const [unit, element] of units.entries()) {
			let wireEndIndex = 0;
			for (const wireEndPos of Elements.wireEnds(element)) {

				if (this.elementProvider.isPlugElement(unit.typeId)) {
					const connected = this.connectedToPos(state, wireEndPos, []);
					if (idsLoaded) {
						this.setUnitLink(linksOnUnits, connected, element, wireEndPos, unit, wireEndIndex);
					}
					this.calcReplacements(unit, connected, state, element, units, replacements);
				} else if (!idsLoaded) {
					const connected = this.connectedToPos(state, wireEndPos, []);
					this.setUnitLink(linksOnUnits, connected, element, wireEndPos, unit, wireEndIndex);
				}

				wireEndIndex++;
			}
		}

		if (!this._udcCache.has(state))
			this.setUdcCache(state, units, startId);

		return replacements;
	}

	private updateCachedIds(startId: number, units: Map<SimulationUnit, Element>, linksOnUnits: Map<PIXI.Point[], number>): void {
		const idDif = this._highestLinkId - startId;
		for (const unit of units.keys()) {
			if (this.elementProvider.isPlugElement(unit.typeId)) {
				continue;
			}
			// TODO
			[unit.inputs, unit.outputs].forEach(arr => {
				for (let i = 0; i < arr.length; i++) {
					arr[i] += idDif;
					this._highestLinkId = Math.max(this._highestLinkId, arr[i]);
				}
			});
		}
	}

	private setUnitLink(linksOnUnits: Map<PIXI.Point[], number>, connected, element, wireEndPos, unit, wireEndIndex: number) {
		const linkId = MapHeler.mapHas(linksOnUnits, connected)
			? MapHeler.mapGet(linksOnUnits, connected)
			: ++this._highestLinkId;
		linksOnUnits.set(connected, linkId);
		if (Elements.isInput(element, wireEndPos)) {
			unit.inputs[wireEndIndex] = linkId;
		} else {
			unit.outputs[wireEndIndex - element.numInputs] = linkId;
		}
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
			const u = MapHeler.valueToKey(units, otherPlug);
			replacements.set(SimulationUnits.concatIO(unit)[0], SimulationUnits.concatIO(u)[0]);
		}
	}

	private fillPlugsInUnitsOnLinks(
		state: ProjectState,
		unitsOnLinks: Map<PIXI.Point[], number>,
		units: Map<SimulationUnit, Element>,
		// plugLinks?: Map<number, number>): void {
		outerUnit?: SimulationUnit): void {

		let plugIndex = 0;
		for (const [unit, element] of units.entries()) {
			if (!this.elementProvider.isPlugElement(unit.typeId))
				continue;
			for (const wireEndPos of Elements.wireEnds(element)) {
				const connected = this.connectedToPos(state, wireEndPos, []);
				const index = plugIndex++;
				unitsOnLinks.set(connected, SimulationUnits.concatIO(outerUnit)[index]);
				unit.inputs = [SimulationUnits.concatIO(outerUnit)[index]];
				unit.outputs = [SimulationUnits.concatIO(outerUnit)[index]];
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
				const oppoPos = Elements.otherWirePos(elem, pos);
				for (const otherPos of this.connectedToPos(state, oppoPos, coveredPoints)) {
					this.pushIfNonExistent(connected, otherPos);
				}
			}
		}
		return connected;
	}

	private pushIfNonExistent(numbers: any[], id: any) {
		if (!numbers.find(i => i === id || i.equals && i.equals(id)))
			numbers.push(id);
	}


	// TODO test
	private dissolveUdcs(units: Map<SimulationUnit, Element>): Map<number, number> {
		const out = new Map<number, number>();
		for (const unit of units.keys()) {
			if (!this.elementProvider.isUserElement(unit.typeId))
				continue;
			this.dissolveSingle(units, unit);
			units.delete(unit);
		}
		return out;
	}

	private dissolveSingle(units: Map<SimulationUnit, Element>, unit: SimulationUnit) {
		// const plugLinks: Map<number, number> = new Map<number, number>();
		// let wireIndex = 0;
		// for (const plugLink of unit.inputs.concat(unit.outputs)) {
		// 	plugLinks.set(wireIndex++, plugLink);
		// }
		const unitsState = this.projects.getProjectById(unit.typeId).currState;
		const {simUnits, replacements} = this.compileInner(unitsState, unit);
		simUnits.forEach((v, k) => {
			units.set(k, v);
		});
		this.doReplacements(units, replacements);
	}

	private doReplacements(units: Map<SimulationUnit, Element>, replacements) {
		for (const u of units.keys()) {
			for (const [from, to] of replacements) {
				[u.inputs, u.outputs].forEach(arr => {
					for (let i = 0; i < arr.length; i++)
						if (arr[i] === from)
							arr[i] = to;
				});
			}
		}
	}
}
