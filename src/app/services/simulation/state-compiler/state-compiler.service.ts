import {Injectable} from '@angular/core';
import {Project} from '../../../models/project';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
import {
	AbsPlugIdsOnLinks, ElementToUnit, LinkOnWireEnd,
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

	private _udcCache: Map<number, CompiledComp>;

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
		this.initElemsOnLinks('' + project.id);
		const depTree = await this.projectSaveManagement.buildDependencyTree(project);
		depTree.set(project.id, project);
		this.compileDependencies(depTree);
		return [];
	}

	private initElemsOnLinks(identifier: string) {
		this._wiresOnLinks = new Map<string, WiresOnLinks>([[identifier, new Map<number, Element[]>()]]);
		this._wireEndsOnLinks = new Map<string, WireEndsOnLinks>([[identifier, new Map<number, WireEndOnComp[]>()]]);
	}


	private compileDependencies(depTree: Map<number, Project>): void {
		for (const [typeId, project] of depTree.entries()) {
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
			connectedPlugs: []
		};
		const linksOnWireEnds: WireEndLinksOnElem = new Map<Element, LinkOnWireEnd>();
		this.setAllLinks(unitElems, linksOnWireEnds, state, compiledComp);
		compiledComp.units = [...unitElems.unitToElement.keys()];
		MapHelper.uniquify(compiledComp);
		console.log(compiledComp);
		return compiledComp;
	}

	private setAllLinks(unitElems: UnitElementBidir, linksOnWireEnds: WireEndLinksOnElem, state: ProjectState, compiledComp: CompiledComp) {
		let unitIndex = 0;
		let linkId = 0;
		for (const element of unitElems.unitToElement.values()) {
			let wireEndIndex = -1;
			for (const wireEndPos of Elements.wireEnds(element)) {
				wireEndIndex++;
				if (this.wireIdHasLink(linksOnWireEnds, element, wireEndIndex))
					continue;
				linkId = this.setLinks(state, wireEndPos, linksOnWireEnds, linkId, unitElems, compiledComp) + 1;
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
				const oppoPos = Elements.otherWirePos(elem, pos);
				this.setLinks(state, oppoPos, linksOnWireEnds, linkId, unitElems, compiledComp, coveredPoints);
				MapHelper.pushInMapArray(compiledComp.wiresOnLinks, linkId, elem);
			} else {
				if (linksOnWireEnds.has(elem)) {
					if (!linksOnWireEnds.get(elem).has(index)) {
						linksOnWireEnds.get(elem).set(index, linkId);
					} else {
						console.error('got here i guess');
					}
				} else {
					linksOnWireEnds.set(elem, new Map<number, number>([[index, linkId]]));
				}
				SimulationUnits.setInputOutput(unitElems.elementToUnit.get(elem), index, linkId);
				MapHelper.pushInMapArray(compiledComp.wireEndsOnLinks, linkId, {
					component: elem,
					wireIndex: index
				});
			}
		}
		return linkId;
	}

	private deletePlugElements(simUnits: UnitToElement) {
		for (const simUnit of simUnits.keys()) {
			if (this.elementProvider.isPlugElement(simUnit.typeId)) {
				simUnits.delete(simUnit);
			}
		}
	}
}
