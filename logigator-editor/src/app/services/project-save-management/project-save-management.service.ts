import {Injectable} from '@angular/core';
import {Project} from '../../models/project';
import * as PIXI from 'pixi.js';
import {Element, ElementRotation} from '../../models/element';
import {ProjectState} from '../../models/project-state';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {ElementType} from '../../models/element-types/element-type';
import {ApiService} from '../api/api.service';
import {LocationService} from '../location/location.service';
import {ProjectData, ProjectDependency, ProjectElement} from '../../models/http/response/project-data';
import {BiDirectionalMap} from '../../models/bi-directional-map';
import {ComponentInfo} from '../../models/http/response/component-info';
import {v4 as genUuid} from 'uuid';
import {ProjectInfo} from '../../models/http/response/project-info';
import {UserService} from '../user/user.service';
import {skipUntil} from 'rxjs/operators';
import {ComponentData} from '../../models/http/response/component-data';
import {ProjectList} from '../../models/http/response/project-list';
import {Response} from '../../models/http/response/response';
import {Observable, ReplaySubject} from 'rxjs';
import {Share} from '../../models/http/response/share';
import {ComponentLocalFile, ProjectLocalFile} from '../../models/project-local-file';
import {FileSaverService} from '../file-saver/file-saver.service';
import {ShareDependencies} from '../../models/http/response/share-dependencies';
import {ErrorHandlingService} from '../error-handling/error-handling.service';

@Injectable({
	providedIn: 'root'
})
export class ProjectSaveManagementService {

	/**
	 * key: uuid
	 * value: editor number id
	 */
	private _mappings = new BiDirectionalMap<string, number>();

	private _projectsCache = new Map<number, Project>();

	private _loadedInitialProjects$ = new ReplaySubject<void>(1);

	constructor(
		private api: ApiService,
		private elementProvider: ElementProviderService,
		private location: LocationService,
		private userService: UserService,
		private fileSaverService: FileSaverService,
		private errorHandling: ErrorHandlingService
	) {
		this.userService.userInfo$.pipe(
			skipUntil(this._loadedInitialProjects$)
		).subscribe(() => this.getAllComponentsInfo());
	}

	public async getInitialProjects(): Promise<Project[]> {
		let projects: Project[];
		if (this.location.isProject) {
			try {
				projects = [await this.getProjectOrComponentUuid(this.location.projectUuid, 'project')];
				this.errorHandling.showInfo('INFO.PROJECTS.OPEN', {name: projects[0].name});
			} catch {
				projects = [this.getEmptyProject()];
				this.location.reset();
			}
		} else if (this.location.isComponent) {
			try {
				const comp = await this.getProjectOrComponentUuid(this.location.componentUuid, 'comp');
				projects = [this.getEmptyProject(), comp];
				this.errorHandling.showInfo('INFO.PROJECTS.OPEN', {name: comp.name});
			} catch {
				projects = [this.getEmptyProject()];
				this.location.reset();
			}
		} else if (this.location.isShare) {
			try {
				const shared = await this.getProjectShare(this.location.shareUuid);
				if (shared.type === 'comp') {
					projects = [this.getEmptyProject(), shared];
				} else {
					projects = [shared];
				}
				this.errorHandling.showInfo('INFO.PROJECTS.OPEN_SHARE', {name: shared.name});
			} catch {
				projects = [this.getEmptyProject()];
				this.location.reset();
			}
		} else {
			projects = [this.getEmptyProject()];
		}
		await this.getAllComponentsInfo();
		this._loadedInitialProjects$.next();
		return projects;
	}

	public async getProjectOrComponentUuid(uuid: string, type: 'project' | 'comp'): Promise<Project> {
		if (this._projectsCache.has(this._mappings.getValue(uuid)))
			return this._projectsCache.get(this._mappings.getValue(uuid));

		const apiPath = type === 'project' ? 'project' : 'component';
		const projectData = await this.api.get<ProjectData & ComponentData>(`/${apiPath}/${uuid}`,
			{errorMessage: 'ERROR.PROJECTS.OPEN'}).toPromise();
		const mappingsToApply = this.saveMappings(projectData.data.dependencies);
		this.setCustomElements(projectData.data.dependencies.map(dep => dep.dependency), 'user');
		const elements = this.convertSavedElementsToElements(projectData.data.elements, mappingsToApply);
		const project = new Project(new ProjectState(elements), {
			id: this.generateNextId(projectData.data.id),
			source: 'server',
			name: projectData.data.name,
			hash: projectData.data.elementsFile.hash,
			public: projectData.data.public,
			link: projectData.data.link,
			type,
		});
		this._projectsCache.set(project.id, project);
		return project;
	}

	public async getComponent(id: number): Promise<Project> {
		if (this._projectsCache.has(id))
			return this._projectsCache.get(id);

		if (this.elementProvider.getElementById(id).category === 'share') {
			const link = this._mappings.getKey(id);
			const sharedComp = await this.api.get<Share>(`/share/${link}`, {errorMessage: 'ERROR.PROJECTS.OPEN_COMP'}).toPromise();
			const mappings = this.saveMappings(sharedComp.data.dependencies);
			const compElements = this.convertSavedElementsToElements(sharedComp.data.elements, mappings);
			const sharedProject = new Project(new ProjectState(compElements), {
				type: 'comp',
				name: sharedComp.data.name,
				source: 'share',
				id
			});
			this._projectsCache.set(sharedProject.id, sharedProject);
			return sharedProject;
		}

		const uuid = this._mappings.getKey(id);
		const componentData = await this.api.get<ComponentData>(`/component/${uuid}`, {errorMessage: 'ERROR.PROJECTS.OPEN_COMP'}).toPromise();
		const mappingsToApply = this.saveMappings(componentData.data.dependencies);
		const elements = this.convertSavedElementsToElements(componentData.data.elements, mappingsToApply);

		const project = new Project(new ProjectState(elements), {
			type: 'comp',
			name: componentData.data.name,
			source: 'server',
			hash: componentData.data.elementsFile.hash,
			id
		});
		this._projectsCache.set(project.id, project);
		return project;
	}

	public async createProjectServer(name: string, description = '', project: Project): Promise<string> {
		const projectResp = await this.api.post<ProjectInfo>('/project', {name, description},
			{errorMessage: 'ERROR.PROJECTS.CREATE'}).toPromise();
		const components = await this.buildDependencyTree(project);
		const createdComps: ComponentInfo[] = [];
		const tempMappings = new BiDirectionalMap<string, number>();
		for (const [id, comp] of components) {
			if (comp.source === 'local') {
				const elemType = this.elementProvider.getElementById(id);
				const createdComp = await this.api.post<ComponentInfo>('/component', {
					name: elemType.name, symbol: elemType.symbol, description: elemType.description
				}, {errorMessage: 'ERROR.PROJECTS.CREATE'}).toPromise();
				tempMappings.set(createdComp.data.id, id);
				createdComps.push(createdComp.data);
			}
		}
		for (const createdComp of createdComps) {
			const elementType = this.elementProvider.getElementById(tempMappings.getValue(createdComp.id));
			const convertedElements = this.convertElementsToSaveElements(components.get(tempMappings.getValue(createdComp.id)).allElements);
			const body = {
				oldHash: createdComp.elementsFile.hash,
				dependencies: convertedElements.usedCustomElements.map(cu => {
					return {
						id: tempMappings.getKey(cu) ?? this._mappings.getKey(cu),
						model: cu,
					};
				}),
				elements: convertedElements.elements,
				numInputs: elementType.numInputs,
				numOutputs: elementType.numOutputs,
				labels: elementType.labels
			};
			await this.api.put<ProjectInfo>(`/component/${createdComp.id}`, body, {errorMessage: 'ERROR.PROJECTS.SAVE'}).toPromise();
		}
		const projectElements = this.convertElementsToSaveElements(project.allElements);
		const projectBody = {
			oldHash: projectResp.data.elementsFile.hash,
			dependencies: projectElements.usedCustomElements.map(cu => {
				return {
					id: tempMappings.getKey(cu) ?? this._mappings.getKey(cu),
					model: cu,
				};
			}),
			elements: projectElements.elements,
		};
		await this.api.put<ProjectInfo>(`/project/${projectResp.data.id}`, projectBody, {errorMessage: 'ERROR.PROJECTS.SAVE'}).toPromise();
		for (const toRemove of tempMappings.values()) {
			this.removeElement(toRemove);
		}
		await this.getAllComponentsInfo();
		return projectResp.data.id;
	}

	public async createComponent(name: string, symbol: string, description: string = ''): Promise<Project> {
		if (this.userService.isLoggedIn) {
			const body = {
				name, symbol, description
			};

			const resp = await this.api.post<ComponentInfo>('/component', body, {errorMessage: 'ERROR.PROJECTS.CREATE'}).toPromise();
			const id = this.generateNextId(resp.data.id);
			this.setCustomElements([resp.data], 'user');

			const project = new Project(new ProjectState(), {
				type: 'comp',
				source: 'server',
				hash: resp.data.elementsFile.hash,
				link: resp.data.link,
				public: resp.data.public,
				name,
				id
			});
			this._projectsCache.set(project.id, project);
			return project;
		} else {
			const id = this.generateNextId();
			this.setCustomElements([{
				id: this._mappings.getKey(id),
				symbol,
				name,
				description,
				numInputs: 0,
				numOutputs: 0,
				labels: []
			}], 'local');
			const project = new Project(new ProjectState(), {
				type: 'comp',
				source: 'local',
				name,
				id
			});
			this._projectsCache.set(project.id, project);
			return project;
		}
	}

	public async saveComponent(project: Project): Promise<void> {
		if (!project.saveDirty)
			return;

		if (project.source !== 'server') {
			this._projectsCache.set(project.id, project);
			project.saveDirty = false;
			return;
		}

		const elementType = this.elementProvider.getElementById(project.id);
		const convertedElements = this.convertElementsToSaveElements(project.allElements);
		const body = {
			oldHash: project.hash,
			dependencies: convertedElements.usedCustomElements.map(cu => {
				return {
					id: this._mappings.getKey(cu),
					model: cu,
				};
			}),
			elements: convertedElements.elements,
			numInputs: elementType.numInputs,
			numOutputs: elementType.numOutputs,
			labels: elementType.labels
		};
		const resp = await this.api.put<ProjectInfo>(`/component/${this._mappings.getKey(project.id)}`, body,
			{errorMessage: 'ERROR.PROJECTS.SAVE'}).toPromise();
		project.saveDirty = false;
		project.hash = resp.data.elementsFile.hash;
		this._projectsCache.set(project.id, project);
		this.errorHandling.showInfo('INFO.PROJECTS.SAVE', {name: project.name});
	}

	public async saveProject(project: Project): Promise<void> {
		if (!project.saveDirty)
			return;

		if (project.source !== 'server') {
			this._projectsCache.set(project.id, project);
			project.saveDirty = false;
			return;
		}

		const convertedElements = this.convertElementsToSaveElements(project.allElements);
		const body = {
			oldHash: project.hash,
			dependencies: convertedElements.usedCustomElements.map(cu => {
				return {
					id: this._mappings.getKey(cu),
					model: cu,
				};
			}),
			elements: convertedElements.elements,
		};
		const resp = await this.api.put<ProjectInfo>(`/project/${this._mappings.getKey(project.id)}`, body,
			{errorMessage: 'ERROR.PROJECTS.SAVE'}).toPromise();
		project.saveDirty = false;
		project.hash = resp.data.elementsFile.hash;
		this._projectsCache.set(project.id, project);
		this.errorHandling.showInfo('INFO.PROJECTS.SAVE', {name: project.name});
	}

	public async exportToFile(project: Project, name?: string) {
		const dependencies = await this.buildDependencyTree(project);
		const components: ComponentLocalFile[] = [];
		for (const [id, dep] of dependencies) {
			const elementType = this.elementProvider.getElementById(id);
			components.push({
				info: {
					id,
					numInputs: elementType.numInputs,
					numOutputs: elementType.numOutputs,
					labels: elementType.labels,
					description: elementType.description,
					name: elementType.name,
					symbol: elementType.symbol
				},
				elements: this.convertElementsToSaveElements(dep.allElements).elements
			});
		}

		const toSave: ProjectLocalFile = {
			project: {
				name: name ?? project.name,
				elements: this.convertElementsToSaveElements(project.allElements).elements
			},
			components
		};
		await this.fileSaverService.saveLocalFile(JSON.stringify(toSave), 'json', name ?? project.name, undefined);
	}

	public openFile(content: string): Project {
		const parsedFile: ProjectLocalFile = JSON.parse(content);

		const mappingsToApply = new Map<number, number>();
		for (const component of parsedFile.components) {
			if (this._mappings.hasValue(component.info.id)) {
				const newId = this.generateNextId();
				mappingsToApply.set(component.info.id, newId);
				component.info.id = newId;
			} else {
				this._mappings.set(genUuid(), component.info.id);
			}
		}
		this.setCustomElements(parsedFile.components.map(c => {
			return {
				...c.info,
				id: this._mappings.getKey(c.info.id)
			};
		}), 'local');
		for (const component of parsedFile.components) {
			const elements = this.convertSavedElementsToElements(component.elements, mappingsToApply);
			const compProject = new Project(new ProjectState(elements), {
				type: 'comp',
				name: component.info.name,
				source: 'local',
				id: component.info.id
			});
			this._projectsCache.set(compProject.id, compProject);
		}
		const projectElements = this.convertSavedElementsToElements(parsedFile.project.elements, mappingsToApply);
		const project = new Project(new ProjectState(projectElements), {
			type: 'project',
			name: parsedFile.project.name,
			source: 'local',
			id: this.generateNextId()
		});
		this._projectsCache.set(project.id, project);
		return project;
	}

	public async buildDependencyTree(project: Project, resolved?: Map<number, Project>): Promise<Map<number, Project>> {
		if (!resolved)
			resolved = new Map<number, Project>();

		for (const element of project.allElements) {
			if (this.elementProvider.isCustomElement(element.typeId) && !resolved.has(element.typeId)) {
				const proj = await this.getComponent(element.typeId);
				resolved.set(element.typeId, proj);
				resolved = new Map([...resolved, ...(await this.buildDependencyTree(proj, resolved))]);
			}
		}
		return resolved;
	}

	public getProjectsInfo(page?: number, search?: string): Observable<Response<ProjectList>> {
		const params: any = {
			size: 5
		};

		if (page)
			params.page = page;
		if (search)
			params.search = search;

		return this.api.get<ProjectList>('/project', {errorMessage: 'ERROR.PROJECTS.GET_PROJECTS'}, params);
	}

	public async getProjectShare(linkId: string): Promise<Project> {
		const resp = await this.api.get<Share>(`/share/${linkId}`, {errorMessage: 'ERROR.PROJECTS.OPEN_SHARE'}).toPromise();
		const mappingsToApply = this.saveMappings(resp.data.dependencies, true);
		this.setCustomElements(resp.data.dependencies.map(dep => dep.dependency), 'share', true);
		const elements = this.convertSavedElementsToElements(resp.data.elements, mappingsToApply);
		const project = new Project(new ProjectState(elements), {
			id: this.generateNextId(linkId),
			source: 'share',
			name: resp.data.name,
			type: resp.data.type,
		});
		this._projectsCache.set(project.id, project);
		if (resp.data.type === 'comp') {
			this.setCustomElements([{...resp.data, link: linkId}], 'share', true);
		}

		const allComponents = await this.api.get<ShareDependencies>(`/share/dependencies/${linkId}`,
			{errorMessage: 'ERROR.PROJECTS.OPEN_SHARE'}).toPromise();
		allComponents.data.dependencies.forEach(comp => this.generateNextId(comp.link));
		this.setCustomElements(allComponents.data.dependencies, 'share', true);

		return project;
	}

	public async cloneProjectShare(project: Project) {
		const link = this._mappings.getKey(project.id);
		const resp = await this.api.get<ProjectInfo>(`/project/clone/${link}`, {errorMessage: 'ERROR.PROJECTS.CLONE_SHARE'}).toPromise();
		return await this.getProjectOrComponentUuid(resp.data.id, project.type);
	}

	/**
	 * returns mappings to apply to loaded elements
	 */
	private saveMappings(dependencies: ProjectDependency[], useLinkForUuid = false): Map<number, number> {
		const mappingsToApply = new Map<number, number>();
		dependencies.forEach(dep => {
			const uuid = useLinkForUuid ? dep.dependency.link : dep.dependency.id;
			if (this._mappings.hasKey(uuid)) {
				mappingsToApply.set(dep.model, this._mappings.getValue(uuid));
			} else {
				this._mappings.set(uuid, dep.model);
			}
		});
		return mappingsToApply;
	}

	private setCustomElements(components: Partial<ComponentInfo>[], category: 'user' | 'local' | 'share', useLinkForUuid = false) {
		const elements: Partial<ElementType>[] = components.map(comp => {
			return {
				id: this._mappings.getValue(useLinkForUuid ? comp.link : comp.id),
				description: comp.description,
				name: comp.name,
				minInputs: comp.numInputs,
				maxInputs: comp.numInputs,
				symbol: comp.symbol,
				numInputs: comp.numInputs,
				numOutputs: comp.numOutputs,
				labels: comp.labels
			};
		});
		this.elementProvider.addElements(elements, category);
	}

	private convertSavedElementsToElements(elements: ProjectElement[], mappings: Map<number, number>): Element[] {
		const mapped: Element[] = [];

		for (const elem of elements) {
			const typeId = mappings.has(elem.t) ? mappings.get(elem.t) : elem.t;
			const elementType = this.elementProvider.getElementById(typeId);

			if (!elementType)
				return;

			const isCustomElement = this.elementProvider.isCustomElement(typeId);

			const element: Element = {
				id: elem.c,
				typeId,
				numInputs: isCustomElement ? elementType.numInputs : (elem.i ?? 0),
				numOutputs: isCustomElement ? elementType.numOutputs : (elem.o ?? 0),
				rotation: elem.r ?? ElementRotation.Right,
				data: elem.s,
				pos: new PIXI.Point(elem.p[0], elem.p[1])
			};
			if (elementType.hasPlugIndex && elem.n)
				element.plugIndex = elem.n[0];
			if (!elementType.hasPlugIndex)
				element.options = elem.n ?? elementType.options;
			if (elem.q)
				element.endPos = new PIXI.Point(elem.q[0], elem.q[1]);

			mapped.push(element);
		}

		return mapped;
	}

	private convertElementsToSaveElements(elements: Element[]): {elements: ProjectElement[], usedCustomElements: number[]} {
		const usedCustomElements: number[] = [];

		const saveElements = elements.map(elem => {
			if (this.elementProvider.isCustomElement(elem.typeId) && !usedCustomElements.includes(elem.typeId))
				usedCustomElements.push(elem.typeId);

			const elementType = this.elementProvider.getElementById(elem.typeId);

			const element: ProjectElement = {
				c: elem.id,
				t: elem.typeId,
				p: [elem.pos.x, elem.pos.y],
			};

			if (elem.rotation && elem.rotation !== 0)
				element.r = elem.rotation;
			if (elem.numInputs && elem.numInputs !== 0)
				element.i = elem.numInputs;
			if (elem.numOutputs && elem.numOutputs !== 0)
				element.o = elem.numOutputs;
			if (elementType.hasPlugIndex && elem.plugIndex)
				element.n = [elem.plugIndex];
			if (!elementType.hasPlugIndex && elem.options)
				element.n = elem.options;
			if (elem.data)
				element.s = elem.data as string;
			if (elem.endPos)
				element.q = [elem.endPos.x, elem.endPos.y];

			return element;
		});

		return {
			elements: saveElements,
			usedCustomElements
		};
	}

	public async getAllComponentsInfo() {
		if (this.userService.isLoggedIn) {
			try {
				const componentData = await this.api.get<ComponentInfo[]>(`/component`, {errorMessage: 'ERROR.PROJECTS.GET_COMPS'}).toPromise();
				componentData.data.forEach(comp => this.generateNextId(comp.id));
				this.setCustomElements(componentData.data, 'user');
			} catch {
				this.clearElements('user');
			}
		} else {
			this.clearElements('user');
		}
	}

	private generateNextId(uuid?: string): number {
		if (this._mappings.hasKey(uuid))
			return this._mappings.getValue(uuid);

		uuid = uuid ?? genUuid();

		let nextId = 1000;
		for (const id of this._mappings.values()) {
			if (id > nextId)
				nextId = id;
		}
		nextId += 1;

		this._mappings.set(uuid, nextId);
		return nextId;
	}

	public getEmptyProject(): Project {
		return Project.empty(undefined, this.generateNextId());
	}

	public clearElements(category: 'user' | 'local' | 'share') {
		const elements = this.elementProvider.getElements(category);
		for (const element of elements) {
			this.removeElement(element.id);
		}
	}

	public removeElement(typeId: number) {
		this._mappings.deleteValue(typeId);
		this._projectsCache.delete(typeId);
		this.elementProvider.removeElement(typeId);
	}

	public getUuidForProject(id: number): string {
		return this._mappings.getKey(id);
	}

}
