import {Injectable} from '@angular/core';
import {Project} from '../../models/project';
import * as PIXI from 'pixi.js';
import {Element} from '../../models/element';
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
import {delayWhen, filter} from 'rxjs/operators';
import {ComponentData} from '../../models/http/response/component-data';
import {ProjectList} from '../../models/http/response/project-list';
import {Response} from '../../models/http/response/response';
import {Observable, ReplaySubject} from 'rxjs';
import {Share} from '../../models/http/response/share';
import {ComponentLocalFile, ProjectLocalFile} from '../../models/project-local-file';
import {saveLocalFile} from '../../models/save-local-file';
import * as assert from 'assert';

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
		private userService: UserService
	) {
		this.userService.userInfo$.pipe(
			delayWhen((value, index) => this._loadedInitialProjects$)
		).subscribe(() => this.getAllComponentsInfo());
	}

	public async getInitialProjects(): Promise<Project[]> {
		let projects: Project[];
		if (this.location.isProject) {
			try {
				const mainProject = await this.getProjectOrComponentUuid(this.location.projectUuid, 'project');
				projects = [mainProject];
			} catch (e) {
				projects = [this.getEmptyProject()];
				this.location.reset();
			}
		} else if (this.location.isComponent) {
			try {
				const comp = await this.getProjectOrComponentUuid(this.location.componentUuid, 'comp');
				const mainProject = this.getEmptyProject();
				projects = [mainProject, comp];
			} catch (e) {
				projects = [this.getEmptyProject()];
				this.location.reset();
			}
		} else if (this.location.isShare) {
			projects = [await this.getProjectsShare(this.location.shareUuid)];
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
		const projectData = await this.api.get<ProjectData & ComponentData>(`/${apiPath}/${uuid}`).toPromise();
		const mappingsToApply = this.saveMappings(projectData.data.dependencies);
		this.setCustomElements(projectData.data.dependencies.map(dep => dep.dependency), 'user');
		const elements = this.convertSavedElementsToElements(projectData.data.elements, mappingsToApply);
		const project = new Project(new ProjectState(elements), {
			id: this.generateNextId(projectData.data.id),
			source: 'server',
			name: projectData.data.name,
			hash: projectData.data.elementsFile.hash,
			type,
		});
		this._projectsCache.set(project.id, project);
		return project;
	}

	public async getComponent(id: number): Promise<Project> {
		if (this._projectsCache.has(id))
			return this._projectsCache.get(id);

		const uuid = this._mappings.getKey(id);
		const componentData = await this.api.get<ComponentData>(`/component/${uuid}`).toPromise();
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
		const projectResp = await this.api.post<ProjectInfo>('/project', {name, description}).toPromise();
		const components = await this.buildDependencyTree(project);
		const createdComps: ComponentInfo[] = [];
		const tempMappings = new BiDirectionalMap<string, number>();
		for (const [id, comp] of components) {
			if (comp.source === 'local') {
				const elemType = this.elementProvider.getElementById(id);
				const createdComp = await this.api.post<ComponentInfo>('/component', {
					name: elemType.name, symbol: elemType.symbol, description: elemType.description
				}).toPromise();
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
			await this.api.put<ProjectInfo>(`/component/${createdComp.id}`, body).toPromise();
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
		await this.api.put<ProjectInfo>(`/project/${projectResp.data.id}`, projectBody).toPromise();
		for (const toRemove of tempMappings.values()) {
			this.elementProvider.removeElement(toRemove);
		}
		await this.getAllComponentsInfo();
		return projectResp.data.id;
	}

	public async createComponent(name: string, symbol: string, description: string = ''): Promise<Project> {
		if (this.userService.isLoggedIn) {
			const body = {
				name, symbol, description
			};

			const resp = await this.api.post<ComponentInfo>('/component', body).toPromise();
			const id = this.generateNextId(resp.data.id);
			this.setCustomElements([resp.data], 'user');

			const project = new Project(new ProjectState(), {
				type: 'comp',
				source: 'server',
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
		const resp = await this.api.put<ProjectInfo>(`/component/${this._mappings.getKey(project.id)}`, body).toPromise();
		project.saveDirty = false;
		project.hash = resp.data.elementsFile.hash;
		this._projectsCache.set(project.id, project);
	}

	public async saveProject(project: Project): Promise<void> {
		if (!project.saveDirty)
			return;

		if (project.source !== 'server') {
			this._projectsCache.set(project.id, project);
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
		const resp = await this.api.put<ProjectInfo>(`/project/${this._mappings.getKey(project.id)}`, body).toPromise();
		project.saveDirty = false;
		project.hash = resp.data.elementsFile.hash;
		this._projectsCache.set(project.id, project);
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
		saveLocalFile(JSON.stringify(toSave), 'json', name ?? project.name, undefined, undefined);
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

		return this.api.get<ProjectList>('/project', undefined, params);
	}

	public async getProjectsShare(linkId: string): Promise<Project> {
		const resp = await this.api.get<Share>(`/share/${linkId}`, undefined).toPromise();
		console.log(resp);
		return this.getEmptyProject();
	}

	/**
	 * returns mappings to apply to loaded elements
	 */
	private saveMappings(dependencies: ProjectDependency[]): Map<number, number> {
		const mappingsToApply = new Map<number, number>();
		dependencies.forEach(dep => {
			if (this._mappings.hasKey(dep.dependency.id)) {
				mappingsToApply.set(dep.model, this._mappings.getValue(dep.dependency.id));
			} else {
				this._mappings.set(dep.dependency.id, dep.model);
			}
		});
		return mappingsToApply;
	}

	private setCustomElements(components: Partial<ComponentInfo>[], category: 'user' | 'local' | 'share') {
		const elements: Partial<ElementType>[] = components.map(comp => {
			return {
				id: this._mappings.getValue(comp.id),
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
				rotation: elem.r ?? 0,
				data: elem.s,
				pos: new PIXI.Point(elem.p[0], elem.p[1])
			};
			if (elementType.hasPlugIndex && elem.n)
				element.plugIndex = elem.n[0];
			if (!elementType.hasPlugIndex)
				element.options = elem.n;
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

	private async getAllComponentsInfo() {
		if (this.userService.isLoggedIn) {
			const componentData = await this.api.get<ComponentInfo[]>(`/component`).toPromise();
			componentData.data.forEach(comp => this.generateNextId(comp.id));
			this.setCustomElements(componentData.data, 'user');
		} else {
			this.elementProvider.clearElements('user');
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

}
