import {Injectable} from '@angular/core';
import {Project} from '../../../models/project';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/simulation-unit';
import {
	ElementToUnit, LinkOnWireEnd,
	PosOfElem, UnitElementBidir,
	UnitToElement, WireEndLinksOnElem,
	WireEndOnComp,
	WireEndsOnLinks,
	WireEndsOnLinksInProject,
	WiresOnLinks,
	WiresOnLinksInProject
} from './compiler-types';
import {Element} from '../../../models/element';
import {ProjectState} from '../../../models/project-state';
import {CompiledComp} from './compiled-comp';
import {ProjectSaveManagementService} from '../../project-save-management/project-save-management.service';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {MapHelper} from './map-helper';
import {Elements} from '../../../models/elements';
import {CompileError} from '../../../models/simulation/error';

@Injectable({
	providedIn: 'root'
})
export class StateCompilerService {

	private _highestLinkId: number;
	private _wiresOnLinks: WiresOnLinksInProject;
	private _wireEndsOnLinks: WireEndsOnLinksInProject;
	private _ioElemUnits: Map<string, Map<Element, SimulationUnit>>;
	private _ioElemIndexes: Map<string, Map<Element, number>>;

	private _wiresOnLinksCache: WiresOnLinksInProject;
	private _wireEndsOnLinksCache: WireEndsOnLinksInProject;

	private _depTree: Map<number, Project>;
	private _compiledDeps: Set<number>;

	private _udcCache: Map<number, CompiledComp>;

	private _currTypeId: number;

	constructor(
		private projectSaveManagement: ProjectSaveManagementService,
		private elementProvider: ElementProviderService
	) {
		this._udcCache = new Map<number, CompiledComp>();
	}

	private static generateUnits(state: ProjectState): UnitElementBidir {
		const unitToElement: UnitToElement = new Map<SimulationUnit, Element>();
		const elementToUnit: ElementToUnit = new Map<Element, SimulationUnit>();
		for (const element of state.model.values()) {
			const unit = SimulationUnits.fromElement(element);
			if (unit) {
				unitToElement.set(unit, element);
				elementToUnit.set(element, unit);
			}
		}
		return {unitToElement, elementToUnit};
	}

	public async compileAsInt32Array(project: Project): Promise<Int32Array> {
		const units = await this.compile(project);
		const out: number[] = [ units.length ];

		for (const unit of units) {
			out.push(unit.typeId, 0 /*op1*/, 0 /*op2*/, unit.inputs.length, unit.outputs.length, ...unit.inputs, ...unit.outputs);
		}
		return new Int32Array(out);
	}

	public async compile(project: Project): Promise<SimulationUnit[]> {
		this._highestLinkId = 0;
		this._wiresOnLinks = new Map<string, WiresOnLinks>();
		this._wireEndsOnLinks = new Map<string, WireEndsOnLinks>();
		const depTree = await this.projectsToCompile(project);
		this._depTree = depTree;

		const start = Date.now();
		this.compileDependencies(depTree);
		const out =  this.projectUnits(project.id, '0');
		console.log(`compilation took ${Date.now() - start}ms`);
		return out;
	}

	private initElemsOnLinksCache(identifier: string): void {
		if (!this._wiresOnLinksCache)
			this._wiresOnLinksCache = new Map<string, WiresOnLinks>();
		if (!this._wireEndsOnLinksCache)
			this._wireEndsOnLinksCache = new Map<string, WireEndsOnLinks>();
		this._wiresOnLinksCache.set(identifier, new Map<number, Element[]>());
		this._wireEndsOnLinksCache.set(identifier, new Map<number, WireEndOnComp[]>());
	}

	private initElemsOnLinks(identifier: string) {
		if (!this._wiresOnLinks)
			this._wiresOnLinks = new Map<string, WiresOnLinks>();
		if (!this._wireEndsOnLinks)
			this._wireEndsOnLinks = new Map<string, WireEndsOnLinks>();
		if (!this._ioElemUnits)
			this._ioElemUnits = new Map<string, Map<Element, SimulationUnit>>();
		if (!this._ioElemIndexes)
			this._ioElemIndexes = new Map<string, Map<Element, number>>();
		this._wiresOnLinks.set(identifier, new Map<number, Element[]>());
		this._wireEndsOnLinks.set(identifier, new Map<number, WireEndOnComp[]>());
		this._ioElemUnits.set(identifier, new Map<Element, SimulationUnit>());
		this._ioElemIndexes.set(identifier, new Map<Element, number>());
	}

	private async projectsToCompile(project: Project): Promise<Map<number, Project>> {
		const out = await this.projectSaveManagement.buildDependencyTree(project);
		out.set(project.id, project);
		return out;
	}

	public clearCache(): void {
		this._udcCache.clear();
		if (this._wiresOnLinksCache) {
			this._wiresOnLinksCache.clear();
			this._wireEndsOnLinksCache.clear();
			this._wiresOnLinks.clear();
			this._wireEndsOnLinks.clear();
			this._ioElemUnits.clear();
			this._ioElemIndexes.clear();
		}
		this._highestLinkId = 0;
	}

	private compileDependencies(depTree: Map<number, Project>): void {
		this._compiledDeps = new Set<number>();
		for (const [typeId, project] of depTree.entries()) {
			if (this._udcCache.has(typeId) && !project.compileDirty) {
				console.log('load from cache', typeId);
			} else {
				this.compileSingle(project);
			}
		}
	}

	private compileSingle(project: Project): void {
		if (this._compiledDeps.has(project.id)) {
			throw {
				name: 'ERROR.COMPILE.CIRCULAR_DEP',
				src: this._currTypeId,
				comp: project.id
			} as CompileError;
		}
		this._compiledDeps.add(project.id);
		const oldTypeId = this._currTypeId;
		this._currTypeId = project.id;
		const unitElems = StateCompilerService.generateUnits(project.currState);
		let conPlugs: number[][];
		if (this._udcCache.has(project.id)) {
			conPlugs = this._udcCache.get(project.id).connectedPlugs;
		}

		this._udcCache.set(project.id, this.calcCompiledComp(project.currState, unitElems));
		if (!MapHelper.array2dSame(conPlugs, this._udcCache.get(project.id).connectedPlugs)) {
			for (const [typeId, compiledComp] of this._udcCache.entries()) {
				if (compiledComp.includesUdcs.has(project.id)) {
					this.compileSingle(this._depTree.get(typeId));
				}
			}
		}
		this._currTypeId = oldTypeId;
		project.compileDirty = false;
	}

	private calcCompiledComp(state: ProjectState, unitElems: UnitElementBidir): CompiledComp {
		const compiledComp: CompiledComp = {
			units: new Map<SimulationUnit, Element>(),
			connectedPlugs: [],
			plugsByIndex: new Map<number, number>(),
			includesUdcs: new Set<number>()
		};

		const linksOnWireEnds: WireEndLinksOnElem = new Map<Element, LinkOnWireEnd>();

		this.setAllLinks(unitElems, linksOnWireEnds, state, compiledComp);

		compiledComp.units = unitElems.unitToElement;
		this.loadConnectedPlugs(compiledComp);

		return compiledComp;
	}

	private setAllLinks(
		unitElems: UnitElementBidir, linksOnWireEnds: WireEndLinksOnElem,
		state: ProjectState, compiledComp: CompiledComp
	) {
		let unitIndex = 0;
		let linkId = 0;
		const identifier = '' + this._currTypeId;
		this.initElemsOnLinksCache(identifier);
		for (const element of unitElems.unitToElement.values()) {
			let wireEndIndex = -1;
			for (const wireEndPos of Elements.wireEnds(element)) {
				wireEndIndex++;
				if (this.wireIdHasLink(linksOnWireEnds, element, wireEndIndex)) {
					continue;
				}
				linkId = this.setLinks(state, wireEndPos, linksOnWireEnds,
					linkId, unitElems, compiledComp) + 1;
			}
			if (this.elementProvider.isPlugElement(element.typeId)) {
				compiledComp.plugsByIndex.set(element.plugIndex, unitIndex);
			}
			unitIndex++;
		}
	}

	private wireIdHasLink(wireEndLinksOnElem: WireEndLinksOnElem, element: Element, wireIndex: number): boolean {
		return wireEndLinksOnElem.has(element) && wireEndLinksOnElem.get(element).has(wireIndex);
	}

	private setLinks(
		state: ProjectState,
		pos: PIXI.Point,
		linksOnWireEnds: WireEndLinksOnElem,
		linkId: number,
		unitElems: UnitElementBidir,
		compiledComp: CompiledComp,
		coveredPoints?: PosOfElem[]
	): number {
		coveredPoints = coveredPoints || [];
		for (const [elem, index] of state.wireEndsOnPoint(pos)) {
			if (coveredPoints.find(p => p.id === elem.id && p.pos.equals(pos)))
				continue;
			coveredPoints.push({id: elem.id, pos});
			if (elem.typeId === 0) {
				this.setWireLink(elem, pos, state, linksOnWireEnds, linkId, unitElems,
					compiledComp, coveredPoints);
			} else {
				this.setCompLink(linksOnWireEnds, elem, index, linkId, unitElems, compiledComp);
				if (this.elementProvider.isUserElement(elem.typeId)) {
					this.includePlugLinks(elem, index, state, linksOnWireEnds,
						linkId, unitElems, compiledComp, coveredPoints);
					compiledComp.includesUdcs.add(elem.typeId);
				}
			}
		}
		return linkId;
	}

	private setWireLink(
		elem, pos: PIXI.Point, state: ProjectState, linksOnWireEnds: WireEndLinksOnElem, linkId: number,
		unitElems: UnitElementBidir, compiledComp: CompiledComp, coveredPoints: PosOfElem[]
	) {
		const oppoPos = Elements.otherWirePos(elem, pos);
		this.setLinks(state, oppoPos, linksOnWireEnds, linkId,
			unitElems, compiledComp, coveredPoints);
		MapHelper.pushInMapArrayUnique(this._wiresOnLinksCache.get('' + this._currTypeId), linkId, elem);
	}

	private setCompLink(
		linksOnWireEnds: WireEndLinksOnElem, elem, wireIndex, linkId: number, unitElems: UnitElementBidir,
		compiledComp: CompiledComp
	) {
		if (linksOnWireEnds.has(elem)) {
			if (!linksOnWireEnds.get(elem).has(wireIndex)) {
				linksOnWireEnds.get(elem).set(wireIndex, linkId);
			} else {
				console.error('you should not be here');
			}
		} else {
			linksOnWireEnds.set(elem, new Map<number, number>([[wireIndex, linkId]]));
		}
		SimulationUnits.setInputOutput(unitElems.elementToUnit.get(elem), wireIndex, linkId);
		const identifier = '' + this._currTypeId;
		MapHelper.pushInMapArray(this._wireEndsOnLinksCache.get(identifier), linkId, {component: elem, wireIndex});
	}

	private includePlugLinks(
		elem, index, state: ProjectState, linksOnWireEnds: WireEndLinksOnElem, linkId: number,
		unitElems: UnitElementBidir, compiledComp: CompiledComp, coveredPoints: PosOfElem[]
	) {
		if (!this._udcCache.has(elem.typeId)) {
			const outer = this._currTypeId;
			this.compileSingle(this._depTree.get(elem.typeId));
		}
		for (const conPlugs of this._udcCache.get(elem.typeId).connectedPlugs) {
			if (conPlugs.includes(index)) {
				for (const wireEndIndex of conPlugs) {
					if (wireEndIndex === index)
						continue;
					this.setLinks(state, Elements.wireEnds(elem)[wireEndIndex], linksOnWireEnds,
						linkId, unitElems, compiledComp, coveredPoints);
				}
			}
		}
	}

	private projectUnits(
		projectId: number, idIdentifier: string,
		outerUnit?: SimulationUnit
	): SimulationUnit[] {
		const compiledComp = this._udcCache.get(projectId);
		const units = SimulationUnits.cloneMult([...compiledComp.units.keys()]);
		if (units.length === 0)
			return [];
		const linkMap = new Map<number, number>();
		const typeIdentifier = '' + projectId;
		if (outerUnit) {
			for (const [outer, inner] of compiledComp.plugsByIndex) {
				linkMap.set(SimulationUnits.concatIO(units[inner])[0], SimulationUnits.concatIO(outerUnit)[outer]);
			}
		}

		if (this._highestLinkId > 0)
			this._highestLinkId++;
		let highestInProj = this._highestLinkId;
		const udcIndexes: number[] = [];
		let unitIndex = 0;
		for (const unit of units) {
			[unit.inputs, unit.outputs].forEach(arr => {
				for (let i = 0; i < arr.length; i++) {
					const newVal = linkMap.has(arr[i]) ? linkMap.get(arr[i]) : arr[i] + this._highestLinkId;
					if (!this._wiresOnLinks.has(idIdentifier)) {
						this.initElemsOnLinks(idIdentifier);
					}
					this.pushWiresOnLink(idIdentifier, newVal, typeIdentifier, arr[i]);
					arr[i] = newVal;
					if (arr[i] > highestInProj) {
						highestInProj = arr[i];
					}
				}
			});
			if (this.elementProvider.isUserElement(unit.typeId)) {
				udcIndexes.push(unitIndex);
			} else if (this.elementProvider.isIoElement(unit.typeId)) {
				this.setIOLink(idIdentifier, compiledComp, unitIndex, unit);
			} else if (this.elementProvider.isPlugElement(unit.typeId)) {
				continue;
			}
			unitIndex++;
		}
		this._highestLinkId = highestInProj;
		if (outerUnit)
			this.removePlugs(compiledComp, units);

		// udcIndexes is already sorted desc
		for (let i = udcIndexes.length - 1; i >= 0; i--) {
			const index = udcIndexes[i];
			const inner = this.projectUnits(units[index].typeId,
				idIdentifier + `:${compiledComp.units.get([...compiledComp.units.keys()][index]).id}`, units[index]);
			units.splice(index, 1);
			units.push(...inner);
		}

		if (!outerUnit) {
			for (const [id, map] of this._ioElemUnits.entries()) {
				this._ioElemIndexes.set(id, new Map<Element, number>());
				for (const [key, val] of map.entries()) {
					this._ioElemIndexes.get(id).set(key, units.indexOf(val));
				}
			}
		}

		return units;
	}

	private setIOLink(idIdentifier: string, compiledComp: CompiledComp, unitIndex: number, realUnit: SimulationUnit) {
		if (!this._ioElemUnits.has(idIdentifier)) {
			this._ioElemUnits.set(idIdentifier, new Map<Element, SimulationUnit>());
		}
		const unit = [...compiledComp.units.keys()][unitIndex];
		const elem = compiledComp.units.get(unit);
		this._ioElemUnits.get(idIdentifier).set(elem, realUnit);
	}

	private pushWiresOnLink(idIdentifier: string, newVal, typeIdentifier, val: number) {
		if (this._wiresOnLinks.get(idIdentifier).has(newVal) && this._wiresOnLinks.get(idIdentifier).get(newVal).length > 0) {
			if (this._wiresOnLinks.get(idIdentifier).get(newVal)[0] !== this._wiresOnLinksCache.get(typeIdentifier).get(val)[0]) {
				this._wiresOnLinks.get(idIdentifier).get(newVal).push(...(this._wiresOnLinksCache.get(typeIdentifier).get(val)) || []);
			}
		} else {
			this._wiresOnLinks.get(idIdentifier).set(newVal, this._wiresOnLinksCache.get(typeIdentifier).get(val) || []);
		}
		if (this._wireEndsOnLinks.get(idIdentifier).has(newVal) && this._wireEndsOnLinks.get(idIdentifier).get(newVal).length > 0) {
			if (this._wireEndsOnLinks.get(idIdentifier).get(newVal)[0] !== this._wireEndsOnLinksCache.get(typeIdentifier).get(val)[0]) {
				this._wireEndsOnLinks.get(idIdentifier).get(newVal).push(...(this._wireEndsOnLinksCache.get(typeIdentifier).get(val)) || []);
			}
		} else {
			this._wireEndsOnLinks.get(idIdentifier).set(newVal, this._wireEndsOnLinksCache.get(typeIdentifier).get(val) || []);
		}
	}

	private removePlugs(compiledComp: CompiledComp, units: SimulationUnit[]) {
		const plugsByIndexSorted = [...compiledComp.plugsByIndex.values()].sort((a, b) => a - b);
		for (let i = plugsByIndexSorted.length - 1; i >= 0; i--) {
			units.splice(plugsByIndexSorted[i], 1);
		}
	}

	private loadConnectedPlugs(compiledComp: CompiledComp) {
		const plugsByIndex = compiledComp.plugsByIndex;
		const plugsByIndexKeys = [...plugsByIndex.keys()];
		for (let i = 0; i < plugsByIndexKeys.length; i++) {
			const plugIndex = plugsByIndexKeys[i];
			const value = SimulationUnits.concatIO([...compiledComp.units.keys()][plugsByIndex.get(plugIndex)])[0];
			for (let j = i + 1; j < plugsByIndexKeys.length; j++) {
				const otherIndex = plugsByIndexKeys[j];
				const otherValue = SimulationUnits.concatIO([...compiledComp.units.keys()][plugsByIndex.get(otherIndex)])[0];
				if (value === otherValue) {
					let pushed = false;
					for (const arr of compiledComp.connectedPlugs) {
						if (arr.includes(plugIndex) && !arr.includes(otherIndex)) {
							arr.push(plugsByIndex.get(otherIndex));
							pushed = true;
						} else if (arr.includes(otherIndex) && !arr.includes(plugIndex)) {
							arr.push(plugsByIndex.get(plugIndex));
							pushed = true;
						} else if (arr.includes(otherIndex) && arr.includes(plugIndex)) {
							pushed = true;
						}
					}
					if (!pushed)
						compiledComp.connectedPlugs.push([plugIndex, otherIndex]);
				}
			}
		}
	}


	get wiresOnLinks(): Map<string, WiresOnLinks> {
		return this._wiresOnLinks;
	}

	get wireEndsOnLinks(): Map<string, WireEndsOnLinks> {
		return this._wireEndsOnLinks;
	}


	get wiresOnLinksCache(): Map<string, WiresOnLinks> {
		return this._wiresOnLinksCache;
	}

	get wireEndsOnLinksCache(): Map<string, WireEndsOnLinks> {
		return this._wireEndsOnLinksCache;
	}

	get ioElemUnits(): Map<string, Map<Element, SimulationUnit>> {
		return this._ioElemUnits;
	}

	get ioElemIndexes(): Map<string, Map<Element, number>> {
		return this._ioElemIndexes;
	}

	get highestLinkId(): number {
		return this._highestLinkId;
	}
}
