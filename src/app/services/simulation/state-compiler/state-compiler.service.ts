import {Injectable} from '@angular/core';
import {Project} from '../../../models/project';
import {SimulationUnit, SimulationUnits} from '../../../models/simulation/SimulationUnit';
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
		const start = Date.now();
		this.initElemsOnLinks('' + project.id);
		const depTree = await this.projectsToCompile(project);
		this.compileDependencies(depTree);

		const units = this.projectUnits(project);
		console.log(`Compilation took ${Date.now() - start}ms`);
		return [];
	}

	private initElemsOnLinks(identifier: string) {
		this._wiresOnLinks = new Map<string, WiresOnLinks>([[identifier, new Map<number, Element[]>()]]);
		this._wireEndsOnLinks = new Map<string, WireEndsOnLinks>([[identifier, new Map<number, WireEndOnComp[]>()]]);
	}

	private async projectsToCompile(project: Project): Promise<Map<number, Project>> {
		const out = await this.projectSaveManagement.buildDependencyTree(project);
		out.set(project.id, project);
		return out;
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
			connectedPlugs: [],
			plugsByIndex: []
		};
		const linksOnWireEnds: WireEndLinksOnElem = new Map<Element, LinkOnWireEnd>();

		this.setAllLinks(unitElems, linksOnWireEnds, state, compiledComp);

		compiledComp.units = [...unitElems.unitToElement.keys()];
		this.loadConnectedPlugs(compiledComp);
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
			if (this.elementProvider.isPlugElement(element.typeId)) {
				compiledComp.plugsByIndex.push(unitIndex);
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
				this.setWireLink(elem, pos, state, linksOnWireEnds, linkId, unitElems, compiledComp, coveredPoints);
			} else {
				this.setCompLink(linksOnWireEnds, elem, index, linkId, unitElems, compiledComp);
				if (this.elementProvider.isUserElement(elem.typeId)) {
					this.includePlugLinks(elem, index, state, linksOnWireEnds, linkId, unitElems, compiledComp, coveredPoints);
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
		this.setLinks(state, oppoPos, linksOnWireEnds, linkId, unitElems, compiledComp, coveredPoints);
		MapHelper.pushInMapArray(compiledComp.wiresOnLinks, linkId, elem);
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
					this.setLinks(state, Elements.wireEnds(elem)[wireEndIndex], linksOnWireEnds, linkId,
						unitElems, compiledComp, coveredPoints);
				}
			}
		}
	}

	private projectUnits(project: Project): SimulationUnit[] {
		const compiledProject = this._udcCache.get(project.id);
		const units = [...compiledProject.units];

		// const idDif = this._
		for (const unit of units) {
			[unit.inputs, unit.outputs].forEach(arr => {
				for (let i = 0; i < arr.length; i++) {

				}
			});
		}

		return [];
	}


	private deletePlugElements(simUnits: UnitToElement) {
		for (const simUnit of simUnits.keys()) {
			if (this.elementProvider.isPlugElement(simUnit.typeId)) {
				simUnits.delete(simUnit);
			}
		}
	}

	private loadConnectedPlugs(compiledComp: CompiledComp) {
		for (let i = 0; i < compiledComp.plugsByIndex.length; i++) {
			const plugIndex = compiledComp.plugsByIndex[i];
			const value = SimulationUnits.concatIO(compiledComp.units[plugIndex])[0];
			for (let j = i + 1; j < compiledComp.plugsByIndex.length; j++) {
				const otherIndex = compiledComp.plugsByIndex[j];
				const otherValue = SimulationUnits.concatIO(compiledComp.units[otherIndex])[0];
				if (value === otherValue) {
					let pushed = false;
					for (const arr of compiledComp.connectedPlugs) {
						if (arr.includes(plugIndex) && !arr.includes(otherIndex)) {
							arr.push(otherIndex);
							pushed = true;
						} else if (arr.includes(otherIndex) && !arr.includes(plugIndex)) {
							arr.push(plugIndex);
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
}
