import {Injectable, NgZone} from '@angular/core';
import {Project} from '../../models/project';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {OpenProjectResponse} from '../../models/http-responses/open-project-response';
import {catchError, filter, map} from 'rxjs/operators';
import {ProjectModel} from '../../models/project-model';
import * as PIXI from 'pixi.js';
import {HttpClient} from '@angular/common/http';
import {Element, Elements} from '../../models/element';
import {ComponentInfoResponse} from '../../models/http-responses/component-info-response';
import {ProjectState} from '../../models/project-state';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {UserService} from '../user/user.service';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {ComponentLocalFile, ProjectLocalFile} from '../../models/project-local-file';
import {ModelDatabaseMap, ProjectModelResponse} from '../../models/http-responses/project-model-response';
import {CreateProjectResponse} from '../../models/http-responses/create-project-response';
import {SaveProjectRequest} from '../../models/http-requests/save-project-request';
import * as FileSaver from 'file-saver';
import {ElementType} from '../../models/element-types/element-type';
import {Observable} from 'rxjs';
import {ProjectInfoResponse} from '../../models/http-responses/project-info-response';

@Injectable({
	providedIn: 'root'
})
export class ProjectSaveManagementService {

	private _projectSource: 'server' | 'share';
	private _componentsFromLocalFile = new Map<number, ComponentLocalFile>();
	private _cloudProjectCache = new Map<number, OpenProjectResponse>();

	constructor(
		private http: HttpClient,
		private elemProvService: ElementProviderService,
		private user: UserService,
		private errorHandling: ErrorHandlingService,
		private ngZone: NgZone
	) {
		this.ngZone.run(() => {
			this.user.userLoginState$.pipe(
				filter(state => state)
			).subscribe(async () => {

				this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
			});
		});
	}

	public async getProjectToOpenOnLoad(): Promise<Project> {
		let project;
		if (location.pathname.startsWith('/board')) {
			project = this.openProjectFromServerOnLoad();
			this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
		} else if (location.pathname.startsWith('/share')) {
			// open share
		} else {
			// #!web
			window.history.pushState(null, null, '/');
			project = Promise.resolve(Project.empty());
			this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
		}
		return project;
	}

	public get isFirstSave(): boolean {
		return !this._projectSource;
	}

	public getAllProjectsInfoFromServer(): Observable<ProjectInfoResponse[]> {
		return this.http.get<HttpResponseData<ProjectInfoResponse[]>>('/api/project/get-all-projects-info').pipe(
			this.errorHandling.catchErrorOperator('Unable to get Projects from Server', undefined),
			map(r => r.result)
		);
	}

	public async addCustomComponent(name: string, symbol: string, description = '') {
		if (!name)
			name = 'New Component';

		const elementProvider = ElementProviderService.staticInstance;
		let duplicate = 0;

		while (Array.from(elementProvider.userDefinedElements.values())
			.map(x => x.name)
			.includes((duplicate === 0) ? name : `${name}-${duplicate}`)) {
			duplicate++;
		}
		name = (duplicate === 0) ? name : `${name}-${duplicate}`;

		let id;
		if (this.user.isLoggedIn) {
			id = await this.newCustomComponentOnServer(name, symbol, description);
			if (!id) return;
			this.elemProvService.addUserDefinedElement({
				numOutputs: 0,
				maxInputs: 0,
				name,
				description,
				symbol,
				numInputs: 0,
				minInputs: 0,
				category: 'user',
				rotation: 0
			}, id);
		} else {
			const newIndex = this.findNextLocalCompId();
			const newComp: ComponentLocalFile = {
				typeId: newIndex,
				data: {
					board: {
						elements: []
					}
				},
				type: {
					numOutputs: 0,
					maxInputs: 0,
					name,
					description,
					symbol,
					numInputs: 0,
					minInputs: 0,
					category: 'user',
					rotation: 0
				}
			};
			this._componentsFromLocalFile.set(newIndex, newComp);
			this.elemProvService.addUserDefinedElement(newComp.type, newIndex);
		}
	}

	public async saveComponent(project: Project) {
		if (!project.dirty) return;
		if (project.id < 1000 && this._componentsFromLocalFile.has(project.id)) {
			const compLocalFile = this._componentsFromLocalFile.get(project.id);
			compLocalFile.data = project.currState.model;
		} else if (this.user.isLoggedIn && project.id >= 1000) {
			if (await this.saveSingleProjectToServer(project)) {
				this.errorHandling.showInfo(`Saved component ${project.name} on Server`);
			} else {
				throw Error();
			}
		}
	}

	private findNextLocalCompId(): number {
		let id = 500;
		while (this._componentsFromLocalFile.has(id)) id++;
		return id;
	}
	public openFromFile(content: string): Project {
		let parsedFile: ProjectLocalFile;
		try {
			parsedFile = JSON.parse(content);
		} catch (e) {
			this.errorHandling.showErrorMessage('Invalid File');
			return;
		}
		delete this._projectSource;
		this.elemProvService.clearElementsFromFile();
		parsedFile.components.forEach(c => {
			this._componentsFromLocalFile.set(c.typeId, c);
			this.elemProvService.addUserDefinedElement(c.type, c.typeId);
		});
		const mainModel = this.getProjectModelFromJson(parsedFile.mainProject.data as ProjectModelResponse);

		// #!web
		window.history.pushState(null, null, `/local/${parsedFile.mainProject.name}`);
		return new Project(new ProjectState(mainModel), {
			type: 'project',
			name: parsedFile.mainProject.name,
			id: parsedFile.mainProject.id
		});
	}

	public async exportToFile(allOpenProjects: Project[], name?: string) {
		const cache = new Map<number, Project>();
		for (const project of allOpenProjects) {
			if (project.id >= 1000) cache.set(project.id, project);
		}
		const mainProject = allOpenProjects.find(p => p.type === 'project');
		const deps = Array.from((await this.buildDependencyTree(mainProject, new Map<number, Project>(), cache)).values());
		const mapping: ModelDatabaseMap[] = [];
		for (let i = 0; i < deps.length; i++) {
			mapping.push({
				model: deps[i].id,
				database: 501 + i
			});
		}
		const modelToSave: ProjectLocalFile = {
			mainProject: {
				id: 500,
				name: name || mainProject.name,
				data: this.applyMappingsLoad(mainProject.currState.model, mapping)
			},
			components: deps.map(c => {
				const type = this.elemProvService.getElementById(c.id);
				if (!type.name.endsWith('-local')) {
					type.name = type.name + '-local';
				}
				return {
					typeId: mapping.find(m => m.model === c.id).database,
					data: this.applyMappingsLoad(c.currState.model, mapping),
					type
				} as ComponentLocalFile;
			}) as ComponentLocalFile[]
		};
		const blob = new Blob([JSON.stringify(modelToSave, null, 2)], {type: 'application/json;charset=utf-8'});
		FileSaver.saveAs(blob, `${name || mainProject.name}.json`);
		this.errorHandling.showInfo('Exported Project and all needed Components');
	}

	private async buildDependencyTree(
		project: Project,
		resolved: Map<number, Project>,
		cachedProjects: Map<number, Project>): Promise<Map<number, Project>> {
		for (const element of project.currState.model.board.elements) {
			if (element.typeId >= 500 && !resolved.has(element.typeId)) {
				let proj;
				if (cachedProjects.has(element.typeId)) {
					proj = cachedProjects.get(element.typeId);
				} else {
					proj = await this.openComponent(element.typeId);
				}
				resolved.set(element.typeId, proj);
				resolved = new Map([...resolved, ...(await this.buildDependencyTree(proj, resolved, cachedProjects))]);
			}
		}
		return resolved;
	}

	public resetProjectSource() {
		delete this._projectSource;
	}

	public async saveAsNewProjectServer(projects: Project[], name: string): Promise<Project> {
		const mainProject = projects.find(p => p.type === 'project');
		const cache = new Map<number, Project>();
		for (const project of projects) {
			if (project.id >= 1000) cache.set(project.id, project);
		}
		const deps = Array.from((await this.buildDependencyTree(mainProject, new Map<number, Project>(), cache)).values());
		const createdComps: Promise<number>[] = [];
		for (const dep of deps) {
			if (dep.id < 1000 && dep.id >= 500) {
				const type = this.elemProvService.getElementById(dep.id);
				createdComps.push(this.newCustomComponentOnServer(dep.name, type.symbol, type.description));
			}
		}
		let mainProjectId = mainProject.id;
		if (mainProject.id < 1000) {
			mainProjectId = await this.createProjectServer(name || mainProject.name);
		}
		const ids = await Promise.all(createdComps);
		let currentDbIdIndex = 0;
		const mappings: ModelDatabaseMap[] = [];
		for (let i = 0; i < deps.length; i++) {
			if (deps[i].id < 1000 && deps[i].id >= 500) {
				mappings.push({
					database: ids[currentDbIdIndex],
					model: deps[i].id
				});
				currentDbIdIndex++;
			}
		}
		const projectsToSave: Project[] = [];
		const mainProjToSave = new Project(new ProjectState(this.applyMappingsLoad(mainProject.currState.model, mappings)), {
			type: 'project',
			name: name || mainProject.name,
			id: mainProjectId
		});
		mainProjToSave.dirty = true;
		projectsToSave.push(mainProjToSave);
		for (const dep of deps) {
			const id = mappings.find(m => m.model === dep.id).database || dep.id;
			const proj = new Project(new ProjectState(this.applyMappingsLoad(dep.currState.model, mappings)), {
				id: mappings.find(m => m.model === dep.id).database || dep.id,
				name: dep.name,
				type: 'comp'
			});
			if (id >= 1000) this.elemProvService.addUserDefinedElement(this.elemProvService.getElementById(dep.id), id);
			proj.dirty = true;
			projectsToSave.push(proj);
		}
		this.elemProvService.clearElementsFromFile();
		this._componentsFromLocalFile.clear();
		await this.saveProjectsToServer(projectsToSave);

		// #!web
		window.history.pushState(null, null, `/board/${mainProjectId}`);
		this.errorHandling.showInfo(`Saved Project ${mainProjToSave.name}`);
		return mainProjToSave;
	}

	private async createProjectServer(name: string): Promise<number> {
		return this.http.post<HttpResponseData<CreateProjectResponse>>('/api/project/create', {
			name,
			isComponent: false
		}).pipe(
			map(r => Number(r.result.id)),
			this.errorHandling.catchErrorOperator('Cannot create Projecct', undefined)
		).toPromise();
	}

	public saveProjects(projects: Project[]) {
		const mainProject = projects.find(p => p.type === 'project');
		if (this._projectSource === 'server') {
			this.saveSingleProjectToServer(mainProject);
		}
		const comps = projects.filter(p => p.type === 'comp');
		const savePromises = [];
		for (const comp of comps) {
			savePromises.push(this.saveComponent(comp));
		}
		Promise.all(savePromises).then(() => this.errorHandling.showInfo('Saved Project and all open Components'));
	}

	public async openComponent(id: number): Promise<Project> {
		if (id < 1000) {
			if (!this._componentsFromLocalFile.has(id)) {
				this.errorHandling.showErrorMessage('Unable to open Component');
				return Promise.resolve(undefined);
			}
			const data = this._componentsFromLocalFile.get(id);
			const project = new Project(new ProjectState(this.getProjectModelFromJson(data.data as ProjectModelResponse)), {
				type: 'comp',
				name: data.type.name,
				id: data.typeId
			});
			return Promise.resolve(project);
		}
		if (this._cloudProjectCache.has(id))
			return Promise.resolve(this.componentFromServerResponse(this._cloudProjectCache.get(id)));
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
			map(response => this.componentFromServerResponse(response.result)),
			this.errorHandling.catchErrorOperatorDynamicMessage((err: any) => {
				if (err.message === 'isProj') return 'Unable to open Project as Component';
				return err.error.error.description;
			}, undefined)
		).toPromise();
	}

	private componentFromServerResponse(openProRes: OpenProjectResponse): Project {
		if (Number(openProRes.project.is_component) === 0) {
			throw Error('isProj');
		}
		const id = Number(openProRes.project.pk_id);
		let project = this.getProjectModelFromJson(openProRes.project.data);
		project = this.applyMappingsLoad(project, openProRes.project.data.mappings);
		project = this.removeMappingsFromModel(project as ProjectModelResponse);
		this._cloudProjectCache.set(id, openProRes);
		return new Project(new ProjectState(project), {
			id: Number(id),
			name: openProRes.project.name,
			type: 'comp'
		});
	}

	public get isShare(): boolean {
		return location.pathname.startsWith('/share/');
	}

	private newCustomComponentOnServer(name: string, symbol: string, description: string = ''): Promise<number> {
		return this.http.post<HttpResponseData<{id: number}>>('/api/project/create', {
			name,
			isComponent: true,
			symbol,
			description
		}).pipe(
			map(response => Number(response.result.id)),
			this.errorHandling.catchErrorOperatorDynamicMessage(
				(err: any) => `Unable to create component: ${err.error.error.description}`,
				undefined
			)
		).toPromise();
	}

	private saveProjectsToServer(projects: Project[]): Promise<any> {
		const allPromises = [];
		projects.forEach(proj => {
			if (proj.dirty) allPromises.push(this.saveSingleProjectToServer(proj));
			proj.dirty = false;
		});
		return Promise.all(allPromises);
	}

	private saveSingleProjectToServer(project: Project): Promise<HttpResponseData<{success: boolean}>> {
		const mappings: ModelDatabaseMap[] = [];
		project.currState.model.board.elements.forEach(el => {
			if (el.typeId >= 500 && !mappings.find(m => m.model === el.typeId)) {
				mappings.push({
					database: el.typeId,
					model: el.typeId
				});
			}
		});

		const body: SaveProjectRequest = {
			data: {
				...project.currState.model,
				...{mappings}
			}
		};
		if (project.type === 'comp') {
			project.currState.inputOutputCount();
			body.num_inputs = project.numInputs;
			body.num_outputs = project.numOutputs;
		}
		const currentlyInCache = this._cloudProjectCache.get(project.id);
		currentlyInCache.project.data = body.data;
		return this.http.post<HttpResponseData<{success: boolean}>>(`/api/project/save/${project.id}`, body).pipe(
			this.errorHandling.catchErrorOperator('Unable to save Component or Project on Server', undefined)
		).toPromise();
	}

	private getCustomElementsFromServer(): Promise<Map<number, ElementType>> {
		if (!this.user.isLoggedIn) {
			return Promise.resolve(new Map());
		}
		return this.http.get<HttpResponseData<ComponentInfoResponse[]>>('/api/project/get-all-components-info').pipe(
			map(data => {
				const newElemTypes = new Map<number, ElementType>();
				data.result.forEach(elem => {
					elem.num_inputs = Number(elem.num_inputs);
					elem.num_outputs = Number(elem.num_outputs);
					const elemType: ElementType = {
						description: elem.description,
						name: elem.name,
						rotation: 0,
						minInputs: elem.num_inputs,
						maxInputs: elem.num_inputs,
						symbol: elem.symbol,
						numInputs: elem.num_inputs,
						numOutputs: elem.num_outputs,
						category: 'user'
					};
					newElemTypes.set(Number(elem.pk_id), elemType);
				});
				return newElemTypes;
			}),
			this.errorHandling.catchErrorOperator('Cannot get Components from Server', new Map<number, ElementType>()),
		).toPromise();
	}

	private getProjectIdToLoadFromUrl(): number {
		const path = location.pathname;
		const id = Number(path.substr(path.lastIndexOf('/') + 1));
		if (Number.isNaN(id)) {
			return null;
		}
		return id;
	}

	private openProjectFromServerOnLoad(): Promise<Project> {
		const id = this.getProjectIdToLoadFromUrl();
		if (!id) {
			this.errorHandling.showErrorMessage('Invalid Url');

			// #!web
			window.history.pushState(null, null, '/');
			return Promise.resolve(Project.empty());
		}
		return this.openProjectFromServer(id);
	}

	private async openProjectFromServer(id: number): Promise<Project> {
		this._projectSource = 'server';
		if (this._cloudProjectCache.has(id))
			return Promise.resolve(this.projectFromServerResponse(this._cloudProjectCache.get(id)));
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
			map(response => this.projectFromServerResponse(response.result)),
			catchError(err => {
				// #!web
				window.history.pushState(null, null, '/');
				delete this._projectSource;
				throw err;
			}),
			this.errorHandling.catchErrorOperatorDynamicMessage((err: any) => {
				if (err.message === 'isComp') return 'Unable to open Component as Project';
				return err.error.error.description;
			}, Project.empty())
		).toPromise();
	}

	private projectFromServerResponse(openProResp: OpenProjectResponse): Project {
		if (Number(openProResp.project.is_component) === 1) {
			throw Error('isComp');
		}
		const id = Number(openProResp.project.pk_id);
		let project = this.getProjectModelFromJson(openProResp.project.data);
		project = this.applyMappingsLoad(project, openProResp.project.data.mappings);
		project = this.removeMappingsFromModel(project as ProjectModelResponse);
		this.errorHandling.showInfo(`Opened Project ${openProResp.project.name}`);
		this._cloudProjectCache.set(id, openProResp);
		return new Project(new ProjectState(project), {
			id: Number(id),
			name: openProResp.project.name,
			type: 'project'
		});
	}

	private applyMappingsLoad(model: ProjectModel, mappings: ModelDatabaseMap[]): ProjectModel {
		const clonedModel: ProjectModel = {
			board: {
				elements: []
			}
		};
		model.board.elements.forEach(el => {
			const newEl = Elements.clone(el);
			const toMapTo = mappings.find(mapping => mapping.model === el.typeId);
			if (toMapTo) {
				newEl.typeId = toMapTo.database;
			}
			clonedModel.board.elements.push(newEl);
		});
		return clonedModel;
	}

	private removeMappingsFromModel(model: ProjectModelResponse): ProjectModel {
		if (model.mappings) {
			delete model.mappings;
		}
		return model;
	}

	private getProjectModelFromJson(data: ProjectModelResponse): ProjectModel {
		if (!data.hasOwnProperty('board')) {
			return {
				board: {
					elements: []
				}
			};
		}
		data.board.elements = data.board.elements.map(e => {
			const elem: Element = {
				id: e.id,
				typeId: e.typeId,
				numOutputs: e.numOutputs,
				numInputs: e.numInputs,
				pos: new PIXI.Point(e.pos.x, e.pos.y),
				endPos: new PIXI.Point(e.endPos.x, e.endPos.y),
				rotation: e.rotation
			};
			return elem;
		});
		return data;
	}
}
