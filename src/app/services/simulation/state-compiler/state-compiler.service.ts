import {Injectable} from '@angular/core';
import {Project} from '../../../models/project';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import {SimulationUnits} from '../../../models/simulation/simulation-units';
import {
	ElementId,
	ElementToUnit, LinkOnWireEnd,
	PosOfElem, UnitElementBidir,
	UnitToElement, WireEndLinksOnElem,
	WireEndOnComp,
	WireEndsOnLinks, WireEndsOnLinksCache,
	WireEndsOnLinksInProject,
	WiresOnLinks, WiresOnLinksCache,
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
import {ElementTypeId} from '../../../models/element-types/element-type-ids';

@Injectable({
	providedIn: 'root'
})
export class StateCompilerService {

	private _highestLinkId: number;

	/**
	 * Contains which wire are on which links for a given project
	 */
	private _wiresOnLinks: WiresOnLinksInProject;

	/**
	 * Contains which wireEnds are on which links for a given project
	 */
	private _wireEndsOnLinks: WireEndsOnLinksInProject;

	/**
	 * Contains on which index of the final output an ioElement is for a given project
	 */
	private _ioElemIndexes: Map<string, Map<ElementId, number>>;

	private _ioElemUnitCache: Map<string, Map<ElementId, SimulationUnit>>;

	/*
	 * OnLink-Caches are used to store which wires/wireEnds are on which links, but per project
	 * If you've got 1 Udc (User-defined-component) placed 2 times in one project
	 *     the caches will contain every wire once, the final output twice
	 */
	private _wiresOnLinksCache: WiresOnLinksCache;
	private _wireEndsOnLinksCache: WireEndsOnLinksCache;

	private _depTree: Map<number, Project>;

	/*
	 * Only to store which projects already started compiling to detect circular dependencies
	 */
	private _compiledDeps: Set<number>;

	/*
	 * The main cache for compiledComps
	 */
	private _udcCache: Map<number, CompiledComp>;

	/*
	 * TypeId of the currently compiling project
	 */
	private _currTypeId: number;

	constructor(
		private projectSaveManagement: ProjectSaveManagementService,
		private elementProvider: ElementProviderService
	) {
		this._udcCache = new Map<number, CompiledComp>();
	}

	/**
	 * Returns the compiler output (SimulationUnit[]) as an Int32Array.
	 * This is to save performance by not copying the output to the simulation-worker, but just share it.
	 * For this you need a simple-typed array.
	 * @param project The Project that need to be compiled.
	 */
	public async compileAsInt32Array(project: Project): Promise<Int32Array> {
		const units = await this.compile(project);
		const out: number[] = [ units.length ];

		for (const unit of units) {
			out.push(unit.type, unit.ops.length || 0,
				unit.inputs.length, unit.outputs.length, ...unit.ops || [], ...unit.inputs, ...unit.outputs);
		}
		return new Int32Array(out);
	}

	/**
	 * Returns a SimulationUnit[], which is the format needed by the wasm-part to work.
	 * @param project The Project that need to be compiled.
	 */
	public async compile(project: Project): Promise<SimulationUnit[]> {
		this._highestLinkId = 0;
		this._wiresOnLinks = new Map<string, WiresOnLinks>();
		this._wireEndsOnLinks = new Map<string, WireEndsOnLinks>();
		const depTree = await this.projectsToCompile(project);
		this._depTree = depTree;

		const start = Date.now();
		this.compileDependencies(depTree);
		const out = this.projectUnits(project.id, '0');
		console.log(`compilation took ${Date.now() - start}ms`);
		return out;
	}

	private initElemsOnLinksCache(identifier: number): void {
		if (!this._wiresOnLinksCache)
			this._wiresOnLinksCache = new Map<number, WiresOnLinks>();
		if (!this._wireEndsOnLinksCache)
			this._wireEndsOnLinksCache = new Map<number, WireEndsOnLinks>();
		this._wiresOnLinksCache.set(identifier, new Map<number, Element[]>());
		this._wireEndsOnLinksCache.set(identifier, new Map<number, WireEndOnComp[]>());
	}

	private initElemsOnLinks(identifier: string) {
		if (!this._wiresOnLinks)
			this._wiresOnLinks = new Map<string, WiresOnLinks>();
		if (!this._wireEndsOnLinks)
			this._wireEndsOnLinks = new Map<string, WireEndsOnLinks>();
		if (!this._ioElemUnitCache)
			this._ioElemUnitCache = new Map<string, Map<ElementId, SimulationUnit>>();
		if (!this._ioElemIndexes)
			this._ioElemIndexes = new Map<string, Map<ElementId, number>>();
		this._wiresOnLinks.set(identifier, new Map<number, Element[]>());
		this._wireEndsOnLinks.set(identifier, new Map<number, WireEndOnComp[]>());
		this._ioElemUnitCache.set(identifier, new Map<ElementId, SimulationUnit>());
		this._ioElemIndexes.set(identifier, new Map<ElementId, number>());
	}

	private async projectsToCompile(project: Project): Promise<Map<number, Project>> {
		const out = await this.projectSaveManagement.buildDependencyTree(project);
		out.set(project.id, project);
		return out;
	}

	/**
	 * Clears the cache so everything has to get recompiled.
	 */
	public clearCache(): void {
		this._udcCache.clear();
		if (this._wiresOnLinksCache) {
			this._wiresOnLinksCache.clear();
			this._wireEndsOnLinksCache.clear();
			this._wiresOnLinks.clear();
			this._wireEndsOnLinks.clear();
			this._ioElemUnitCache.clear();
			this._ioElemIndexes.clear();
		}
		this._highestLinkId = 0;
	}

	private compileDependencies(depTree: Map<number, Project>): void {
		this._compiledDeps = new Set<number>();
		for (const [typeId, project] of depTree.entries()) {
			if (this._udcCache.has(typeId) && !project.compileDirty) {
				console.log('load from cache', typeId, project.name);
			} else {
				this.compileSingle(project);
			}
		}
	}

	/*
	 * Compiles a single project
	 * If this project already started to compile before it throws a circular dependency exception
	 * If the argument project is a component and it detects, that plug-components aren't connected with each other as
	 *     in the cached version (if existing) it also recompiles all projects containing this component
	 */
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
		const unitElems = SimulationUnits.generateUnits(project.currState);
		let conPlugs: number[][];

		if (this._udcCache.has(project.id)) {
			conPlugs = this._udcCache.get(project.id).connectedPlugs;
		}
		this._udcCache.set(project.id, this.calcCompiledComp(project.currState, unitElems));

		this.compilerOuterIfNeeded(conPlugs, project);

		this._currTypeId = oldTypeId;
		project.compileDirty = false;
	}

	private compilerOuterIfNeeded(conPlugs: number[][], project: Project) {
		if (!MapHelper.array2dSame(conPlugs, this._udcCache.get(project.id).connectedPlugs)) {
			for (const [typeId, compiledComp] of this._udcCache.entries()) {
				if (compiledComp.includesUdcs.has(project.id)) {
					this.compileSingle(this._depTree.get(typeId));
				}
			}
		}
	}

	/*
	 * Simply compiles the state to a CompiledComp (used to generate the final output)
	 */
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
		SimulationUnits.loadConnectedPlugs(compiledComp);

		return compiledComp;
	}


	private setAllLinks(
		unitElems: UnitElementBidir, linksOnWireEnds: WireEndLinksOnElem,
		state: ProjectState, compiledComp: CompiledComp
	): void {
		let unitIndex = 0;
		let linkId = 0;
		this.initElemsOnLinksCache(this._currTypeId);
		for (const element of unitElems.unitToElement.values()) {
			let wireEndIndex = -1;
			for (const wireEndPos of Elements.wireEnds(element)) {
				wireEndIndex++;
				if (SimulationUnits.wireIdHasLink(linksOnWireEnds, element, wireEndIndex)) {
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
			if (elem.typeId === ElementTypeId.WIRE) {
				this.setWireLink(elem, pos, state, linksOnWireEnds, linkId, unitElems,
					compiledComp, coveredPoints);
			} else {
				this.setCompLink(linksOnWireEnds, elem, index, linkId, unitElems);
				if (this.elementProvider.isUserElement(elem.typeId)) {
					this.includePlugLinks(elem, index, state, linksOnWireEnds,
						linkId, unitElems, compiledComp, coveredPoints);
					compiledComp.includesUdcs.add(elem.typeId);
				}
			}
		}
		return linkId;
	}

	/*
	 * When the element is a wire it has to include elements on the other end too (that's the use of a wire)
	 */
	private setWireLink(
		elem, pos: PIXI.Point, state: ProjectState, linksOnWireEnds: WireEndLinksOnElem, linkId: number,
		unitElems: UnitElementBidir, compiledComp: CompiledComp, coveredPoints: PosOfElem[]
	) {
		const oppoPos = Elements.otherWirePos(elem, pos);
		this.setLinks(state, oppoPos, linksOnWireEnds, linkId,
			unitElems, compiledComp, coveredPoints);
		MapHelper.pushInMapArrayUnique(this._wiresOnLinksCache.get(this._currTypeId), linkId, elem);
	}

	/*
	 * When the element is a component just set the input/output to be the wanted link
	 */
	private setCompLink(linksOnWireEnds: WireEndLinksOnElem, elem, wireIndex, linkId: number, unitElems: UnitElementBidir) {
		if (linksOnWireEnds.has(elem)) {
			linksOnWireEnds.get(elem).set(wireIndex, linkId);
		} else {
			linksOnWireEnds.set(elem, new Map<number, number>([[wireIndex, linkId]]));
		}
		SimulationUnits.setInputOutput(unitElems.elementToUnit.get(elem), wireIndex, linkId);
		MapHelper.pushInMapArray(this._wireEndsOnLinksCache.get(this._currTypeId), linkId, {component: elem, wireIndex});
	}

	/*
	 * When the element is a Udc (User-defined-component) and 2 plugs are directly connected the other side of that connection has to
	 *     be included too
	 */
	private includePlugLinks(
		elem, index, state: ProjectState, linksOnWireEnds: WireEndLinksOnElem, linkId: number,
		unitElems: UnitElementBidir, compiledComp: CompiledComp, coveredPoints: PosOfElem[]
	) {
		if (!this._udcCache.has(elem.typeId)) {
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








	/*
	 * After all compiledComps were calculated and store which component is part of which link (link always start at 0 in every compiledComp)
	 * it is time to bring them all together
	 */
	private projectUnits(
		projectId: number, idIdentifier: string,
		outerUnit?: SimulationUnit
	): SimulationUnit[] {
		const compiledComp = this._udcCache.get(projectId);
		const units = SimulationUnits.cloneMult([...compiledComp.units.keys()]);
		if (units.length === ElementTypeId.WIRE)
			return [];
		const linkMap = new Map<number, number>();

		if (outerUnit) {
			for (const [outer, inner] of compiledComp.plugsByIndex) {
				linkMap.set(SimulationUnits.concatIO(units[inner])[0], SimulationUnits.concatIO(outerUnit)[outer]);
				this._highestLinkId++;
			}
		}

		if (this._highestLinkId > 0)
			this._highestLinkId++;
		let highestInProj = this._highestLinkId;
		const udcIndexes: number[] = [];
		const udcIndexesInclPlug: number[] = [];
		let unitIndex = 0;
		let donePlugCount = 0;

		for (const unit of units) {
			[unit.inputs, unit.outputs].forEach(arr => {
				for (let i = 0; i < arr.length; i++) {
					const newVal = linkMap.has(arr[i]) ? linkMap.get(arr[i]) : arr[i] + this._highestLinkId;
					if (!this._wiresOnLinks.has(idIdentifier)) {
						this.initElemsOnLinks(idIdentifier);
					}
					this.pushWiresOnLink(idIdentifier, newVal, projectId, arr[i]);
					arr[i] = newVal;
					if (arr[i] > highestInProj) {
						highestInProj = arr[i];
					}
				}
			});

			if (this.elementProvider.isUserElement(unit.type)) {
				udcIndexes.push(unitIndex);
				udcIndexesInclPlug.push(unitIndex + donePlugCount);
			} else if (this.elementProvider.isIoElement(unit.type)) {
				this.setIOLink(idIdentifier, compiledComp, unitIndex + donePlugCount, unit);
			} else if (this.elementProvider.isPlugElement(unit.type)) {
				donePlugCount++;
				continue;
			}

			unitIndex++;
		}

		this._highestLinkId = highestInProj;
		if (outerUnit)
			SimulationUnits.removePlugs(units, compiledComp);

		// udcIndexes is already sorted desc
		for (let i = udcIndexes.length - 1; i >= 0; i--) {
			const index = udcIndexes[i];
			const innerIdIdentifier = `${idIdentifier}:${[...compiledComp.units.values()][udcIndexesInclPlug[i]].id}`;
			const inner = this.projectUnits(units[index].type, innerIdIdentifier, units[index]);
			units.splice(index, 1);
			units.push(...inner);
		}

		for (const [id, map] of this._ioElemUnitCache.entries()) {
			this._ioElemIndexes.set(id, new Map<ElementId, number>());
			for (const [key, val] of map.entries()) {
				this._ioElemIndexes.get(id).set(key, units.indexOf(val));
			}
		}

		return units;
	}

	/*
	 * Push the wires and wireEnds of a specific link from cache to the final output
	 */
	private pushWiresOnLink(idIdentifier: string, newVal, typeIdentifier: number, val: number) {
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

	private setIOLink(idIdentifier: string, compiledComp: CompiledComp, unitIndex: number, realUnit: SimulationUnit) {
		if (!this._ioElemUnitCache.has(idIdentifier)) {
			this._ioElemUnitCache.set(idIdentifier, new Map<ElementId, SimulationUnit>());
		}
		const unit = [...compiledComp.units.keys()][unitIndex];
		const elem = compiledComp.units.get(unit);
		this._ioElemUnitCache.get(idIdentifier).set(elem.id, realUnit);
	}


	get wiresOnLinks(): Map<string, WiresOnLinks> {
		return this._wiresOnLinks;
	}

	get wireEndsOnLinks(): Map<string, WireEndsOnLinks> {
		return this._wireEndsOnLinks;
	}

	get ioElemIndexes(): Map<string, Map<number, number>> {
		return this._ioElemIndexes;
	}

	get highestLinkId(): number {
		return this._highestLinkId;
	}
}
