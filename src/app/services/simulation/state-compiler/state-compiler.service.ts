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
import {Element, Elements} from '../../../models/element';
import {ProjectState} from '../../../models/project-state';
import {CompiledComp} from './compiled-comp';
import {ProjectSaveManagementService} from '../../project-save-management/project-save-management.service';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {ProjectsService} from '../../projects/projects.service';
import {MapHelper} from './map-helper';

@Injectable({
	providedIn: 'root'
})
export class StateCompilerService {

	public static staticInstance: StateCompilerService;

	private _highestLinkId: number;
	private _wiresOnLinks: WiresOnLinksInProject;
	private _wireEndsOnLinks: WireEndsOnLinksInProject;

	private _wiresOnLinksCache: WiresOnLinksInProject;
	private _wireEndsOnLinksCache: WireEndsOnLinksInProject;

	private _udcCache: Map<number, CompiledComp>;

	private _currTypeId: number;

	constructor(
		private projectSaveManagement: ProjectSaveManagementService,
		private elementProvider: ElementProviderService,
		private projects: ProjectsService
	) {
		StateCompilerService.staticInstance = this;

		this._udcCache = new Map<number, CompiledComp>();
	}

	private static generateUnits(state: ProjectState): UnitElementBidir {
		const unitToElement: UnitToElement = new Map<SimulationUnit, Element>();
		const elementToUnit: ElementToUnit = new Map<Element, SimulationUnit>();
		for (const element of state.allElements) {
			const unit = SimulationUnits.fromElement(element);
			if (unit) {
				unitToElement.set(unit, element);
				elementToUnit.set(element, unit);
			}
		}
		return {unitToElement, elementToUnit};
	}

	public async compile(project: Project): Promise<SimulationUnit[]> {
		const start = Date.now();
		this._highestLinkId = 0;
		this.initElemsOnLinks('0');
		const depTree = await this.projectsToCompile(project);
		this.compileDependencies(depTree);

		const units = this.projectUnits(project.id, '0');
		console.log(`Compilation took ${Date.now() - start}ms`);
		return units;
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
		this._wiresOnLinks.set(identifier, new Map<number, Element[]>());
		this._wireEndsOnLinks.set(identifier, new Map<number, WireEndOnComp[]>());
	}

	private async projectsToCompile(project: Project): Promise<Map<number, Project>> {
		const out = await this.projectSaveManagement.buildDependencyTree(project);
		out.set(project.id, project);
		return out;
	}

	public clearCache(): void {
		this._udcCache = new Map<number, CompiledComp>();
		this._highestLinkId = 0;
	}

	private compileDependencies(depTree: Map<number, Project>): void {
		for (const [typeId, project] of depTree.entries()) {
			this._currTypeId = typeId;
			this._udcCache.set(typeId, this.compileSingle(project));
		}
	}

	private compileSingle(project: Project): CompiledComp {
		const unitElems = StateCompilerService.generateUnits(project.currState);
		return this.calcCompiledComp(project.currState, unitElems);
	}

	private calcCompiledComp(state: ProjectState, unitElems: UnitElementBidir): CompiledComp {
		const compiledComp: CompiledComp = {
			units: [],
			wiresOnLinks: new Map<number, Element[]>(),
			wireEndsOnLinks: new Map<number, WireEndOnComp[]>(),
			connectedPlugs: [],
			plugsByIndex: new Map<number, number>()
		};
		const linksOnWireEnds: WireEndLinksOnElem = new Map<Element, LinkOnWireEnd>();

		this.setAllLinks(unitElems, linksOnWireEnds, state, compiledComp);

		compiledComp.units = [...unitElems.unitToElement.keys()];
		this.loadConnectedPlugs(compiledComp);
		MapHelper.uniquify(compiledComp);

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
				if (this.wireIdHasLink(linksOnWireEnds, element, wireEndIndex))
					continue;
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
		// TODO coveredPoints as Map
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
		MapHelper.pushInMapArray(compiledComp.wiresOnLinks, linkId, elem);
		MapHelper.pushInMapArrayUnique(this._wiresOnLinksCache.get('' + this._currTypeId), linkId, elem);
	}

	private setCompLink(
		linksOnWireEnds: WireEndLinksOnElem, elem, index, linkId: number, unitElems: UnitElementBidir,
		compiledComp: CompiledComp
	) {
		if (linksOnWireEnds.has(elem)) {
			if (!linksOnWireEnds.get(elem).has(index)) {
				linksOnWireEnds.get(elem).set(index, linkId);
			} else {
				console.error('you should not be here');
			}
		} else {
			linksOnWireEnds.set(elem, new Map<number, number>([[index, linkId]]));
		}
		SimulationUnits.setInputOutput(unitElems.elementToUnit.get(elem), index, linkId);
		MapHelper.pushInMapArray(compiledComp.wireEndsOnLinks, linkId, {
			component: elem,
			wireIndex: index
		});
		const identifier = '' + this._currTypeId;
		MapHelper.pushInMapArray(this._wireEndsOnLinksCache.get(identifier), linkId, elem);
	}

	private includePlugLinks(
		elem, index, state: ProjectState, linksOnWireEnds: WireEndLinksOnElem, linkId: number,
		unitElems: UnitElementBidir, compiledComp: CompiledComp, coveredPoints: PosOfElem[]
	) {
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
		const units = SimulationUnits.cloneMult(compiledComp.units);
		const linkMap = new Map<number, number>();
		const typeIdentifier = '' + projectId;
		if (outerUnit) {
			for (const [outer, inner] of compiledComp.plugsByIndex) {
				linkMap.set(SimulationUnits.concatIO(units[inner])[0], SimulationUnits.concatIO(outerUnit)[outer]);
			}
			this.removePlugs(compiledComp, units);
		}

		let highestInProj = this._highestLinkId;
		const udcIndexes: number[] = [];
		let unitIndex = 0;
		for (const unit of units) {
			[unit.inputs, unit.outputs].forEach(arr => {
				for (let i = 0; i < arr.length; i++) {
					const newVal = linkMap.has(arr[i]) ? linkMap.get(arr[i]) : arr[i] + this._highestLinkId;
					// TODO right projectID
					if (!this._wiresOnLinks.get(idIdentifier)) {
						this.initElemsOnLinks(idIdentifier);
					}
					this._wiresOnLinks.get(idIdentifier).set(newVal, this._wiresOnLinksCache.get(typeIdentifier).get(arr[i]));
					this._wireEndsOnLinks.get(idIdentifier).set(newVal, this._wireEndsOnLinksCache.get(typeIdentifier).get(arr[i]));
					arr[i] = newVal;
					if (arr[i] > highestInProj) {
						highestInProj = arr[i];
					}
				}
			});
			if (this.elementProvider.isUserElement(unit.typeId)) {
				udcIndexes.push(unitIndex);
			}
			unitIndex++;
		}
		this._highestLinkId = highestInProj;

		// udcIndexes is already sorted desc
		for (let i = udcIndexes.length - 1; i >= 0; i--) {
			const index = udcIndexes[i];
			const inner = this.projectUnits(units[index].typeId,
				idIdentifier + `:${index}`, units[index]);
			units.splice(index, 1);
			units.push(...inner);
		}

		return units;
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
			const value = SimulationUnits.concatIO(compiledComp.units[plugsByIndex.get(plugIndex)])[0];
			for (let j = i + 1; j < plugsByIndexKeys.length; j++) {
				const otherIndex = plugsByIndexKeys[j];
				const otherValue = SimulationUnits.concatIO(compiledComp.units[plugsByIndex.get(otherIndex)])[0];
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


	get highestLinkId(): number {
		return this._highestLinkId;
	}
}
