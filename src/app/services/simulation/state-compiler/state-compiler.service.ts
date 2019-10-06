import {Injectable} from '@angular/core';
import {ProjectState} from '../../../models/project-state';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
import {Element, Elements} from '../../../models/element';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {ProjectsService} from '../../projects/projects.service';
import {MapHelper} from './map-helper';
import {CompiledComp} from './compiled-comp';

@Injectable({
	providedIn: 'root'
})
export class StateCompilerService {

	public static staticInstance: StateCompilerService;

	private _highestLinkId: number;
	private _udcCache: Map<ProjectState, CompiledComp>;

	constructor(
		private elementProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		StateCompilerService.staticInstance = this;
	}

	public compile(state: ProjectState): SimulationUnit[] {
		this._udcCache = new Map<ProjectState, CompiledComp>();
		this._highestLinkId = 0;
		return [...this.compileInner(state).simUnits.keys()];
	}

	// TODO check for recursion: userDefComp cannot include itself
	private compileInner(state: ProjectState, unit?: SimulationUnit):
		{simUnits: Map<SimulationUnit, Element>, replacements: Map<number, number>} {

		let simulationUnits;
		if (this._udcCache.has(state)) {
			const compiledComp = this._udcCache.get(state);
			this.setUdcCache(state, compiledComp);
			simulationUnits = this._udcCache.get(state).units;
		} else {
			simulationUnits = this.generateUnits(state);
		}
		const replacements = this.setAllLinks(state, simulationUnits, unit);
		this.deletePlugElements(simulationUnits);
		this.dissolveUdcs(simulationUnits);
		return {simUnits: simulationUnits, replacements};
	}

	private setUdcCache(state: ProjectState, compiledComp: CompiledComp): void {
		this._udcCache.set(state, {
			startId: compiledComp.startId,
			units: MapHelper.cloneMap(compiledComp.units),
			connectedToPlug: compiledComp.connectedToPlug
		});
	}

	private copyCache(state: ProjectState): void {
		this.setUdcCache(state, this._udcCache.get(state));
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
		outerUnit?: SimulationUnit): Map<number, number> {

		let compiledComp: CompiledComp;
		let replacements: Map<number, number>;

		if (this._udcCache.has(state)) {
			this.copyCache(state);
			replacements = this.updateCachedIds(state, outerUnit);
			console.log(replacements);
		} else {
			const linksOnUnits = new Map<PIXI.Point[], number>();
			compiledComp = {
				startId: this._highestLinkId,
				units,
				connectedToPlug: new Map<number, {compIndex: number, wireIndex: number}[]>()
			};
			const plugsOnLinks = this.fillPlugsInUnitsOnLinks(state, linksOnUnits, units, outerUnit);
			replacements = this.calcAllLinks(state, units, linksOnUnits, compiledComp.connectedToPlug, plugsOnLinks);
			compiledComp.connectedToPlug = this.calcPlugConnections(units, replacements);
			console.log('setCache', compiledComp.connectedToPlug);
			this.setUdcCache(state, compiledComp);
		}
		return replacements;
	}

	private calcPlugConnections(units: Map<SimulationUnit, Element>, replacements: Map<number, number>):
		Map<number, {compIndex: number, wireIndex: number}[]> {

		const out = new Map<number, {compIndex: number, wireIndex: number}[]>();
		let compIndex = 0;
		this.doReplacements(units, replacements);
		for (const [unit, element] of units) {
			if (this.elementProvider.isPlugElement(unit.typeId)) {
				const linkId = SimulationUnits.concatIO(unit)[0];
				out.set(compIndex, []);
				const oppoCompIndex = 0;
				for (const oppositeUnit of units.keys()) {
					if (this.elementProvider.isPlugElement(oppositeUnit.typeId) || oppositeUnit === unit)
						continue;
					const allCons = SimulationUnits.concatIO(oppositeUnit);
					for (let i = 0; i < allCons.length; i++) {
						if (allCons[i] === linkId) {
							out.get(compIndex).push({compIndex: oppoCompIndex, wireIndex: i});
						}
					}
				}
			}
			compIndex++;
		}
		return out;
	}


	private calcAllLinks(
		state: ProjectState,
		units: Map<SimulationUnit, Element>,
		linksOnUnits: Map<PIXI.Point[], number>,
		connectedToPlug: Map<number, {compIndex: number, wireIndex: number}[]>,
		plugsOnLink: Map<number, number[]>):
		Map<number, number> {

		const replacements = new Map<number, number>();

		let unitIndex = 0;
		for (const [unit, element] of units.entries()) {
			let wireEndIndex = 0;
			for (const wireEndPos of Elements.wireEnds(element)) {

				if (this.elementProvider.isPlugElement(unit.typeId)) {
					const connected = this.connectedToPos(state, wireEndPos, []);
					this.calcReplacements(unit, connected, state, units, replacements);
				} else {
					const connected = this.connectedToPos(state, wireEndPos, []);
					const {linkId, index} = this.setUnitLink(linksOnUnits, connected, element, unit, wireEndIndex, plugsOnLink);
					if (index !== undefined) {
						const con = {compIndex: unitIndex, wireIndex: index};
						for (const plugId of plugsOnLink.get(linkId)) {
							if (connectedToPlug.has(plugId)) {
								connectedToPlug.get(plugId).push(con);
							} else {
								connectedToPlug.set(plugId, [con]);
							}
						}
					}
				}

				wireEndIndex++;
			}
			unitIndex++;
		}
		return replacements;
	}

	private updateCachedIds(state: ProjectState, outerUnit: SimulationUnit): Map<number, number> {
		const compiledComp = this._udcCache.get(state);
		const idDif = this._highestLinkId - compiledComp.startId;
		const replacements = new Map<number, number>();

		const plugIndexes: number[] = [];
		let compIndex = 0;
		for (const unit of compiledComp.units.keys()) {
			if (this.elementProvider.isPlugElement(unit.typeId)) {
				plugIndexes.push(compIndex);
			}
			[unit.inputs, unit.outputs].forEach(arr => {
				for (let i = 0; i < arr.length; i++) {
					arr[i] += idDif;
					this._highestLinkId = Math.max(this._highestLinkId, arr[i]);
				}
			});
			compIndex++;
		}

		let plugIndex = 0;
		for (const absPlugIndex of plugIndexes) {
			const connected = compiledComp.connectedToPlug.get(absPlugIndex);
			for (const con of connected) {
				const u = [...compiledComp.units.keys()][con.compIndex];
				const arr = con.wireIndex < u.inputs.length ? u.inputs : u.outputs;
				arr[con.wireIndex] = SimulationUnits.concatIO(outerUnit)[plugIndex];
			}
			this.calcReplacements(compiledComp.units[absPlugIndex], connected, state, compiledComp.units, replacements);
			plugIndex++;
		}
		return replacements;
	}

	private setUnitLink(
		linksOnUnits: Map<PIXI.Point[], number>,
		connected, element, unit,
		wireEndIndex: number, plugsOnLink: Map<number, number[]>):
		{linkId: number, index: number} {

		const out: {linkId: number, index: number} = {linkId: undefined, index: undefined};
		let linkId;
		if (MapHelper.mapHas(linksOnUnits, connected)) {
			linkId = MapHelper.mapGet(linksOnUnits, connected);
		} else {
			linkId = ++this._highestLinkId;
		}
		linksOnUnits.set(connected, linkId);
		let side: number[];
		let index: number;
		if (wireEndIndex < element.numInputs) {
			side = unit.inputs;
			index = wireEndIndex;
		} else {
			side = unit.outputs;
			index = wireEndIndex - element.numInputs;
		}
		side[index] = linkId;
		if (plugsOnLink.has(linkId)) {
			out.index = index;
		}
		out.linkId = linkId;
		return out;
	}

	private calcReplacements(unit, connected, state: ProjectState, units: Map<SimulationUnit, Element>, replacements) {
		const element = units.get(unit);
		const otherPlugs: Element[] = [];
		for (const pos of connected) {
			for (const elem of state.wireEndsOnPoint(pos)) {
				if (this.elementProvider.isPlugElement(elem.typeId) && elem.id !== element.id) {
					otherPlugs.push(elem);
				}
			}
		}
		for (const otherPlug of otherPlugs) {
			const u = MapHelper.valueToKey(units, otherPlug);
			replacements.set(SimulationUnits.concatIO(unit)[0], SimulationUnits.concatIO(u)[0]);
		}
	}

	private fillPlugsInUnitsOnLinks(
		state: ProjectState,
		unitsOnLinks: Map<PIXI.Point[], number>,
		units: Map<SimulationUnit, Element>,
		outerUnit?: SimulationUnit):
		Map<number, number[]> {

		const out = new Map<number, number[]>();
		let plugIndex = 0;
		let allUnitsIndex = -1;
		for (const [unit, element] of units.entries()) {
			allUnitsIndex++;
			if (!this.elementProvider.isPlugElement(unit.typeId))
				continue;
			const wireEndPos = Elements.wireEnds(element)[0];
			const connected = this.connectedToPos(state, wireEndPos, []);
			const absIndex = plugIndex++;
			if (outerUnit)
				unitsOnLinks.set(connected, SimulationUnits.concatIO(outerUnit)[absIndex]);
			const val = SimulationUnits.concatIO(outerUnit)[absIndex];
			unit.inputs = [val];
			unit.outputs = [val];
			if (out.has(val)) {
				out.get(val).push(allUnitsIndex);
			} else {
				out.set(val, [allUnitsIndex]);
			}
		}
		return out;
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
