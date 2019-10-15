import {Injectable} from '@angular/core';
import {ProjectState} from '../../../models/project-state';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
import {Element, Elements} from '../../../models/element';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {ProjectsService} from '../../projects/projects.service';
import {MapHelper} from './map-helper';
import {CompiledComp} from './compiled-comp';
import {
	AbsPlugIdsOnLinks,
	CompPlugByIndex,
	ConnectedToPlugByIndex,
	LinksOnWireEnds, PosOfElem,
	Replacement, ReplacementById,
	UdcInnerData,
	UnitToElement, WireEndOnComp, WireEndsOnLinks, WireEndsOnLinksInProject, WiresOnLinks, WiresOnLinksInProject
} from './compiler-types';
import {Project} from '../../../models/project';
import {debug} from 'util';

@Injectable({
	providedIn: 'root'
})
export class StateCompilerService {

	public static staticInstance: StateCompilerService;

	private _highestLinkId: number;
	private _wiresOnLinks: WiresOnLinksInProject;
	private _wireEndsOnLinks: WireEndsOnLinksInProject;
	private _udcCache: Map<ProjectState, CompiledComp> = new Map<ProjectState, CompiledComp>();

	private _currId: number;
	private _elemsOnConCache: WireEndOnComp[] = [];

	constructor(
		private elementProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		StateCompilerService.staticInstance = this;
	}

	private static generateUnits(state: ProjectState): UnitToElement {
		const simUnits: UnitToElement = new Map<SimulationUnit, Element>();
		for (const element of state.allElements) {
			const unit = SimulationUnits.fromElement(element);
			if (unit) {
				simUnits.set(unit, element);
			}
		}
		return simUnits;
	}

	public compile(project: Project): SimulationUnit[] {
		// this._udcCache = new Map<ProjectState, CompiledComp>();
		const state = project.currState;
		this._highestLinkId = 0;
		this._currId = project.id;
		this.initElemsOnLinks(project.id);
		const {units, replacements} = this.compileInner(state);
		return [...units.keys()];
	}

	private initElemsOnLinks(id: number) {
		this._wiresOnLinks = new Map<number, WiresOnLinks>([[id, new Map<number, Element[]>()]]);
		this._wireEndsOnLinks = new Map<number, WireEndsOnLinks>([[id, new Map<number, WireEndOnComp[]>()]]);
	}

// TODO check for recursion: userDefComp cannot include itself
	private compileInner(state: ProjectState, outerUnit?: SimulationUnit): UdcInnerData {
		let units;
		if (outerUnit && this._udcCache.has(state)) {
			units = this._udcCache.get(state).units;
		} else {
			units = StateCompilerService.generateUnits(state);
		}
		const replacements = this.setAllLinks(state, units, outerUnit);
		this.copyCache(state);
		this.deletePlugElements(units);
		this.dissolveUdcs(units);
		return {units, replacements};
	}

	private setUdcCache(state: ProjectState, compiledComp: CompiledComp): void {
		this._udcCache.set(state, {
			startId: compiledComp.startId,
			units: MapHelper.cloneMapSimUnits(compiledComp.units),
			connectedToPlug: compiledComp.connectedToPlug,
			replacements: compiledComp.replacements
		});
	}

	private copyCache(state: ProjectState): void {
		this.setUdcCache(state, this._udcCache.get(state));
	}

	private deletePlugElements(simUnits: UnitToElement) {
		for (const simUnit of simUnits.keys()) {
			if (this.elementProvider.isPlugElement(simUnit.typeId)) {
				simUnits.delete(simUnit);
			}
		}
	}

	private setAllLinks(
		state: ProjectState,
		units: UnitToElement,
		outerUnit?: SimulationUnit):
		Replacement {

		let compiledComp: CompiledComp;

		if (outerUnit && this._udcCache.has(state)) {
			return this.updateCachedIds(state, outerUnit);
		} else {
			compiledComp = {
				startId: this._highestLinkId,
				units,
				connectedToPlug: new Map<number, CompPlugByIndex[]>(),
				replacements: undefined
			};
			return this.setNoncachedLinks(outerUnit, state, compiledComp);
		}
	}

	private setNoncachedLinks(
		outerUnit: SimulationUnit, state: ProjectState, compiledComp: CompiledComp):
		Replacement {
		const linksOnWireEnds: LinksOnWireEnds = new Map<PIXI.Point[], number>();
		const units = compiledComp.units;
		let plugsOnLinks: AbsPlugIdsOnLinks = new Map<number, number[]>();
		if (outerUnit)
			plugsOnLinks = this.fillPlugsInLinksOnWireEnds(state, linksOnWireEnds, units, outerUnit);
		const ret = this.calcAllLinks(state, units, linksOnWireEnds, compiledComp.connectedToPlug, plugsOnLinks);
		// this.doReplacements(units, ret.replacements);
		// this.doElemOnLinksReplacements(this._currId, ret.replacements);
		compiledComp.connectedToPlug = this.calcPlugConsForCache(units);
		compiledComp.replacements = ret.replacementPos;
		this.setUdcCache(state, compiledComp);
		return ret.replacements;
	}

	private fillPlugsInLinksOnWireEnds(
		state: ProjectState,
		linksOnWireEnds: LinksOnWireEnds,
		units: UnitToElement,
		outerUnit: SimulationUnit):
		AbsPlugIdsOnLinks {

		const out: AbsPlugIdsOnLinks = new Map<number, number[]>();
		let absPlugIndex = 0;
		let absUnitIndex = -1;
		for (const [unit, element] of units.entries()) {
			absUnitIndex++;
			if (!this.elementProvider.isPlugElement(unit.typeId))
				continue;
			const wireEndPos = Elements.wireEnds(element)[0];
			const connected = this.connectedToPos(state, wireEndPos);
			const absIndex = absPlugIndex++;
			const link = SimulationUnits.concatIO(outerUnit)[absIndex];
			linksOnWireEnds.set(connected, link);
			unit.inputs = [link];
			unit.outputs = [link];
			if (out.has(link)) {
				out.get(link).push(absUnitIndex);
			} else {
				out.set(link, [absUnitIndex]);
			}
		}
		return out;
	}

	private calcPlugConsForCache(units: UnitToElement):
		ConnectedToPlugByIndex {

		const connectedToPlug: ConnectedToPlugByIndex = new Map<number, CompPlugByIndex[]>();
		let compIndex = 0;
		for (const unit of units.keys()) {
			if (this.elementProvider.isPlugElement(unit.typeId)) {
				const linkId = SimulationUnits.concatIO(unit)[0];
				connectedToPlug.set(compIndex, []);
				let oppoCompIndex = -1;
				for (const oppositeUnit of units.keys()) {
					oppoCompIndex++;
					if (this.elementProvider.isPlugElement(oppositeUnit.typeId) || oppositeUnit === unit)
						continue;
					const allCons = SimulationUnits.concatIO(oppositeUnit);
					for (let i = 0; i < allCons.length; i++) {
						if (allCons[i] === linkId) {
							connectedToPlug.get(compIndex).push({compIndex: oppoCompIndex, wireIndex: i});
						}
					}
				}
			}
			compIndex++;
		}
		return connectedToPlug;
	}


	private calcAllLinks(
		state: ProjectState,
		units: UnitToElement,
		linksOnWireEnds: LinksOnWireEnds,
		connectedToPlug: ConnectedToPlugByIndex,
		plugsOnLink: AbsPlugIdsOnLinks):
		{replacements: Replacement, replacementPos: ReplacementById} {

		const replacements = new Map<number, number>();
		const replacementPos = new Map<number, number[]>();

		let unitIndex = 0;
		let plugIndex = 0;
		for (const [unit, element] of units.entries()) {
			let wireEndIndex = 0;
			for (const wireEndPos of Elements.wireEnds(element)) {
				if (this.elementProvider.isPlugElement(unit.typeId)) {
					const connected = this.connectedToPos(state, wireEndPos);
					this.calcReplacements(unit, connected, state, units, replacements, replacementPos, plugIndex++);
				} else {
					const connected = this.connectedToPos(state, wireEndPos, true);
					const {linkId, index} = this.setUnitLink(linksOnWireEnds, connected, element, unit, wireEndIndex, plugsOnLink);
					this._elemsOnConCache = [];
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
		return {replacements, replacementPos};
	}

	private updateCachedIds(state: ProjectState, outerUnit: SimulationUnit): Replacement {
		const compiledComp = this._udcCache.get(state);
		const idDif = this._highestLinkId - compiledComp.startId;

		const plugIndexes: number[] = [];
		let compIndex = 0;
		for (const unit of compiledComp.units.keys()) {
			if (this.elementProvider.isPlugElement(unit.typeId)) {
				plugIndexes.push(compIndex);
			}
			[unit.inputs, unit.outputs].forEach(arr => {
				for (let i = 0; i < arr.length; i++) {
					this.addToWireOnLinkKeys(outerUnit.typeId, arr[i], arr[i] + idDif);
					arr[i] += idDif;
					this._highestLinkId = Math.max(this._highestLinkId, arr[i]);
				}
			});
			compIndex++;
		}

		const replacements = new Map<number, number>();
		let plugIndex = 0;
		const allUnits = [...compiledComp.units.keys()];
		for (const absPlugIndex of plugIndexes) {
			const connected = compiledComp.connectedToPlug.get(absPlugIndex);
			for (const con of connected) {
				const u = allUnits[con.compIndex];
				const arr = con.wireIndex < u.inputs.length ? u.inputs : u.outputs;
				const index = con.wireIndex < u.inputs.length ? con.wireIndex : con.wireIndex - u.inputs.length;
				this.addToWireOnLinkKeys(outerUnit.typeId, arr[index],
					SimulationUnits.concatIO(outerUnit)[plugIndex]);
				arr[index] = SimulationUnits.concatIO(outerUnit)[plugIndex];
			}
			plugIndex++;
		}
		const outerPugs = SimulationUnits.concatIO(outerUnit);
		for (const [fromPlug, toPlugs] of compiledComp.replacements.entries()) {
			replacements.set(outerPugs[fromPlug], outerPugs[toPlugs[toPlugs.length - 1]]);
		}
		return replacements;
	}

	private addToWireOnLinkKeys(typeId: number, from: number, to: number) {
		[this._wiresOnLinks.get(typeId),
			this._wireEndsOnLinks.get(typeId)].forEach(map => {
			if (map.has(from)) {
				// @ts-ignore
				map.set(to, map.get(from));
			} else {
				console.error('why does this not exist?', map, from);
			}
		});
	}

	private setUnitLink(
		linksOnWireEnds: LinksOnWireEnds,
		connected, element, unit,
		wireEndIndex: number, plugsOnLink: AbsPlugIdsOnLinks):
		{linkId: number, index: number} {

		const out: {linkId: number, index: number} = {linkId: undefined, index: undefined};
		let linkId;
		if (MapHelper.mapHas(linksOnWireEnds, connected)) {
			linkId = MapHelper.mapGet(linksOnWireEnds, connected);
		} else {
			linkId = ++this._highestLinkId;
		}
		if (!this._wiresOnLinks.get(this._currId).has(linkId)) {
			this._wiresOnLinks.get(this._currId).set(linkId, []);
			this._wireEndsOnLinks.get(this._currId).set(linkId, []);
		}
		this._elemsOnConCache.forEach(wireEndComp => {
			if (wireEndComp.component.typeId === 0) {
				if (!this._wiresOnLinks.get(this._currId).get(linkId).find(e => e.id === wireEndComp.component.id))
					this._wiresOnLinks.get(this._currId).get(linkId).push(wireEndComp.component);
			} else {
				this._wireEndsOnLinks.get(this._currId).get(linkId).push(wireEndComp);
			}
		});
		linksOnWireEnds.set(connected, linkId);
		let index: number;
		if (wireEndIndex < element.numInputs) {
			index = wireEndIndex;
			unit.inputs[index] = linkId;
		} else {
			index = wireEndIndex - element.numInputs;
			unit.outputs[index] = linkId;
		}
		if (plugsOnLink.has(linkId)) {
			out.index = index;
		}
		out.linkId = linkId;
		return out;
	}

	private calcReplacements(
		unit, connected, state: ProjectState,
		units: UnitToElement,
		replacements, replacementPos, unitIndex) {

		const element = units.get(unit);
		const otherPlugs: Element[] = [];
		let plugIndex = 0;
		for (const pos of connected) {
			for (const elem of state.wireEndsOnPoint(pos)) {
				if (this.elementProvider.isPlugElement(elem.typeId) && elem.id !== element.id) {
					otherPlugs.push(elem);
					if (!replacementPos.has(unitIndex)) {
						replacementPos.set(unitIndex, [plugIndex]);
					} else {
						replacementPos.get(unitIndex).push(plugIndex);
					}
					plugIndex++;
				}
			}
		}
		for (const otherPlug of otherPlugs) {
			const u = MapHelper.valueToKey(units, otherPlug);
			replacements.set(SimulationUnits.concatIO(unit)[0], SimulationUnits.concatIO(u)[0]);
		}
	}

	private connectedToPos(state: ProjectState, pos: PIXI.Point, setElems?: boolean, coveredPoints?: PosOfElem[]): PIXI.Point[] {
		const connected: PIXI.Point[] = [];
		coveredPoints = coveredPoints || [];
		for (const elem of state.wireEndsOnPoint(pos)) {
			if (coveredPoints.find(p => p.id === elem.id && p.pos.equals(pos)))
				continue;
			coveredPoints.push({id: elem.id, pos});
			if (setElems && !this._elemsOnConCache.find(e => e.component.id === elem.id))
				this._elemsOnConCache.push({component: elem, wireIndex: Elements.wireEndIndex(elem, pos)});
			if (elem.typeId === 0) {
				const oppoPos = Elements.otherWirePos(elem, pos);
				for (const otherPos of this.connectedToPos(state, oppoPos, false, coveredPoints)) {
					this.pushIfNonExistent(connected, otherPos);
				}
			} else {
				this.pushIfNonExistent(connected, pos);
			}
		}
		return connected;
	}

	private pushIfNonExistent(numbers: any[], id: any) {
		if (!numbers.find(i => i === id || i.equals && i.equals(id)))
			numbers.push(id);
	}


	private dissolveUdcs(units: UnitToElement): Map<number, number> {
		const out = new Map<number, number>();
		for (const unit of units.keys()) {
			if (!this.elementProvider.isUserElement(unit.typeId))
				continue;
			this.dissolveSingle(units, unit);
			units.delete(unit);
		}
		return out;
	}

	private dissolveSingle(otherUnits: UnitToElement, outerUnit: SimulationUnit) {
		const unitsState = this.projects.getProjectById(outerUnit.typeId).currState;
		const typeId = this._currId;
		this._currId = outerUnit.typeId;
		if (!this._wiresOnLinks.has(outerUnit.typeId)) {
			this._wiresOnLinks.set(outerUnit.typeId, new Map<number, Element[]>());
			this._wireEndsOnLinks.set(outerUnit.typeId, new Map<number, WireEndOnComp[]>());
		}
		const {units, replacements} = this.compileInner(unitsState, outerUnit);
		this._currId = typeId;
		units.forEach((v, k) => {
			otherUnits.set(k, v);
		});
		this.doReplacements(otherUnits, replacements);
		this.doElemOnLinksReplacements(this._currId, replacements);
	}

	private doReplacements(units: UnitToElement, replacements: Replacement) {
		for (const u of units.keys()) {
			for (const [from, to] of replacements.entries()) {
				[u.inputs, u.outputs].forEach(arr => {
					for (let i = 0; i < arr.length; i++)
						if (arr[i] === from)
							arr[i] = to;
				});
			}
		}
	}

	private doElemOnLinksReplacements(typeId: number, replacements: Replacement) {
		const wireOnLinks = this._wiresOnLinks.get(typeId);
		const wireEndsOnLinks = this._wireEndsOnLinks.get(typeId);
		for (const [from, to] of replacements.entries()) {
			if (from === to)
				continue;
			[wireOnLinks, wireEndsOnLinks].forEach(map => {
				if (map.has(from)) {
					if (!map.has(to)) {
						map.set(to, []);
					}
					// @ts-ignore
					map.get(to).push(...map.get(from));
					map.delete(from);
				}
			});
		}
	}

	get wiresOnLinks(): Map<number, WiresOnLinks> {
		return this._wiresOnLinks;
	}

	get wireEndsOnLinks(): Map<number, WireEndsOnLinks> {
		return this._wireEndsOnLinks;
	}
}
