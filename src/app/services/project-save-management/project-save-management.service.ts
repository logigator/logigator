import {Injectable, NgZone, Optional} from '@angular/core';
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
import {ElementType} from '../../models/element-types/element-type';
import {Observable} from 'rxjs';
import {ProjectInfoResponse} from '../../models/http-responses/project-info-response';
import {environment} from '../../../environments/environment';
import {ElectronService} from 'ngx-electron';
import {saveLocalFile} from './save-local-file';
import {SharingService} from '../sharing/sharing.service';

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
		private ngZone: NgZone,
		@Optional() private electronService: ElectronService,
		private sharing: SharingService
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
			this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
			project = this.openProjectFromServerOnLoad();
		} else if (location.pathname.startsWith('/share')) {
			this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
			project = this.openProjectFromShare();
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
		return this.http.get<HttpResponseData<ProjectInfoResponse[]>>(environment.apiPrefix + '/api/project/get-all-projects-info').pipe(
			this.errorHandling.catchErrorOperator('Unable to get Projects from Server', undefined),
			map(r => r.result)
		);
	}

	public async addCustomComponent(name: string, symbol: string, description = '') {
		if (!name)
			name = 'New Component';

		let duplicate = 0;

		while (Array.from(this.elemProvService.userDefinedElements.values())
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
		this.errorHandling.showInfo(`Created Component ${name}`);
	}

	private async openProjectFromShare(): Promise<Project> {
		const address = location.pathname.substr(location.pathname.lastIndexOf('/') + 1);
		this._projectSource = 'share';
		const resp = await this.sharing.openShare(address).pipe(
			this.errorHandling.catchErrorOperator('Unable to open shared project', undefined)
		).toPromise();
		if (!resp) {
			// !#web
			window.history.pushState(null, null, '/');
			delete this._projectSource;
			return Project.empty();
		}
		const model = this.convertResponseDataToProjectModel(resp.data);
		const project = new Project(new ProjectState(model), {
			name: resp.project.name,
			type: 'project',
			id: resp.project.id
		});
		this.errorHandling.showInfo(`Opened shared Project ${resp.project.name} from ${resp.user.username}`);
		return project;
	}

	public async cloneShare(): Promise<Project> {
		if (!this.isShare) return;
		const address = location.pathname.substr(location.pathname.lastIndexOf('/') + 1);
		const resp = await this.http.get<HttpResponseData<any>>(`${environment.apiPrefix}/api/project/clone/${address}`).pipe(
			this.errorHandling.catchErrorOperator('Unable to clone project', undefined)
		).toPromise();
		if (resp) {
			this.errorHandling.showInfo('Cloned Project');
			this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
			return this.openProjectFromServer(resp.result.id, true);
		}
	}

	public async saveProject(project: Project): Promise<void> {
		if (!project.saveDirty) return;
		if (project.id < 1000 && this._componentsFromLocalFile.has(project.id)) {
			const compLocalFile = this._componentsFromLocalFile.get(project.id);
			compLocalFile.data = project.currState.model;
		} else if (this.user.isLoggedIn && project.id >= 1000) {
			await this.saveSingleProjectToServer(project);
			this.errorHandling.showInfo(`Saved ${project.name} on Server`);
		} else {
			this.errorHandling.showErrorMessage('Unable to save');
			throw new Error();
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
			this.elemProvService.clearElementsFromFile();
			parsedFile.components.forEach(c => {
				this._componentsFromLocalFile.set(c.typeId, c);
				this.elemProvService.addUserDefinedElement(c.type, c.typeId);
			});
			let mainModel = this.getProjectModelFromJson(parsedFile.mainProject.data as ProjectModelResponse);
			mainModel = this.adjustInputsAndOutputs(mainModel);

			// #!web
			window.history.pushState(null, null, `/local/${parsedFile.mainProject.name}`);
			return new Project(new ProjectState(mainModel), {
				type: 'project',
				name: parsedFile.mainProject.name,
				id: parsedFile.mainProject.id
			});
		} catch (e) {
			this.errorHandling.showErrorMessage('Invalid File');
		}
	}

	public async exportToFile(project: Project, name?: string) {
		let deps;
		try {
			deps = Array.from((await this.buildDependencyTree(project)).values());
		} catch (e) {
			this.errorHandling.showErrorMessage('Unable resolve dependencies of Project');
			return;
		}
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
				name: name || project.name,
				data: this.applyMappingsLoad(project.currState.model, mapping)
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
		if (await saveLocalFile(modelToSave, name || project.name, this.electronService))
			this.errorHandling.showInfo('Exported Project and all needed Components');
	}

	public async buildDependencyTree(project: Project, resolved?: Map<number, Project>): Promise<Map<number, Project>> {
		if (!resolved) resolved = new Map<number, Project>();
		for (const element of project.allElements) {
			if (element.typeId >= 500 && !resolved.has(element.typeId)) {
				const proj = await this.openComponent(element.typeId);
				resolved.set(element.typeId, proj);
				resolved = new Map([...resolved, ...(await this.buildDependencyTree(proj, resolved))]);
			}
		}
		return resolved;
	}

	public resetProjectSource() {
		delete this._projectSource;
	}

	public async saveAsNewProjectServer(project: Project, name: string): Promise<Project> {
		let deps;
		try {
			deps = Array.from((await this.buildDependencyTree(project)).values());
		} catch (e) {
			this.errorHandling.showErrorMessage('Unable resolve dependencies of Project');
			return;
		}
		const createdComps: Promise<number>[] = [];
		for (const dep of deps) {
			if (dep.id < 1000 && dep.id >= 500) {
				const type = this.elemProvService.getElementById(dep.id);
				createdComps.push(this.newCustomComponentOnServer(dep.name, type.symbol, type.description));
			}
		}
		let mainProjectId = project.id;
		if (project.id < 1000) {
			mainProjectId = await this.createProjectServer(name || project.name);
			if (mainProjectId === undefined) return;
		}
		const ids = await Promise.all(createdComps);
		if (!ids.every(id => id !== undefined)) return;
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
		const mainProjToSave = new Project(new ProjectState(this.applyMappingsLoad(project.currState.model, mappings)), {
			type: 'project',
			name: name || project.name,
			id: mainProjectId
		});
		mainProjToSave.saveDirty = true;
		projectsToSave.push(mainProjToSave);
		for (const dep of deps) {
			const singleMapping = mappings.find(m => m.model === dep.id);
			let id;
			if (singleMapping) {
				id = singleMapping.database;
			} else {
				id = dep.id;
			}
			const proj = new Project(new ProjectState(this.applyMappingsLoad(dep.currState.model, mappings)), {
				id,
				name: dep.name,
				type: 'comp'
			});
			if (id >= 1000) this.elemProvService.addUserDefinedElement(this.elemProvService.getElementById(dep.id), id);
			proj.saveDirty = true;
			projectsToSave.push(proj);
		}
		this.elemProvService.clearElementsFromFile();
		this._componentsFromLocalFile.clear();
		await this.saveProjectsAndComponents(projectsToSave);

		// #!web
		window.history.pushState(null, null, `/board/${mainProjectId}`);
		this._projectSource = 'server';
		return mainProjToSave;
	}

	private async createProjectServer(name: string): Promise<number> {
		return this.http.post<HttpResponseData<CreateProjectResponse>>(environment.apiPrefix + '/api/project/create', {
			name,
			isComponent: false
		}).pipe(
			map(r => Number(r.result.id)),
			this.errorHandling.catchErrorOperator('Cannot create Project', undefined)
		).toPromise();
	}

	public async saveProjectsAndComponents(projects: Project[]) {
		const mainProject = projects.find(p => p.type === 'project');
		const savePromises = [];
		if (mainProject) {
			savePromises.push(this.saveProject(mainProject));
			mainProject.saveDirty = false;
		}
		const comps = projects.filter(p => p.type === 'comp');
		for (const comp of comps) {
			savePromises.push(this.saveProject(comp));
			comp.saveDirty = false;
		}
		await Promise.all(savePromises);
		if (savePromises.length > 0) this.errorHandling.showInfo('Saved Project and all open Components');
	}

	public async openComponent(id: number): Promise<Project> {
		if (id < 1000) {
			if (!this._componentsFromLocalFile.has(id)) {
				this.errorHandling.showErrorMessage('Unable to open Component');
				return Promise.resolve(undefined);
			}
			const data = this._componentsFromLocalFile.get(id);
			let model = this.getProjectModelFromJson(data.data as ProjectModelResponse);
			model = this.adjustInputsAndOutputs(model);
			const project = new Project(new ProjectState(model), {
				type: 'comp',
				name: data.type.name,
				id: data.typeId
			});
			return Promise.resolve(project);
		}
		if (this._cloudProjectCache.has(id))
			return Promise.resolve(this.componentFromServerResponse(this._cloudProjectCache.get(id)));
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`${environment.apiPrefix}/api/project/open/${id}`).pipe(
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
		const project = this.convertResponseDataToProjectModel(openProRes.project.data);
		this._cloudProjectCache.set(id, openProRes);
		return new Project(new ProjectState(project), {
			id: Number(id),
			name: openProRes.project.name,
			type: 'comp'
		});
	}

	private convertResponseDataToProjectModel(openProRes: ProjectModelResponse): ProjectModel {
		let project = this.getProjectModelFromJson(openProRes);
		project = this.applyMappingsLoad(project, openProRes.mappings);
		project = this.adjustInputsAndOutputs(project);
		project = this.removeMappingsFromModel(project as ProjectModelResponse);
		return project;
	}

	public get isShare(): boolean {
		return this._projectSource === 'share';
	}

	public get isFromServer(): boolean {
		return this._projectSource === 'server';
	}

	private newCustomComponentOnServer(name: string, symbol: string, description: string = ''): Promise<number> {
		return this.http.post<HttpResponseData<{id: number}>>(environment.apiPrefix + '/api/project/create', {
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

	private saveSingleProjectToServer(project: Project): Promise<HttpResponseData<{success: boolean}>> {
		if (project.id < 1000) return;
		const body = this.projectToSaveRequest(project);
		const currentlyInCache = this._cloudProjectCache.get(project.id);
		if (currentlyInCache) currentlyInCache.project.data = body.data;
		return this.http.post<HttpResponseData<{success: boolean}>>(`${environment.apiPrefix}/api/project/save/${project.id}`, body).pipe(
			this.errorHandling.showErrorMessageOnErrorOperator('Unable to save Component or Project on Server')
		).toPromise();
	}

	private projectToSaveRequest(project: Project): SaveProjectRequest {
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
		return body;
	}

	public saveComponentShare(project: Project) {
		const body = this.projectToSaveRequest(project);
		const currentlyInCache = this._cloudProjectCache.get(project.id);
		if (currentlyInCache) currentlyInCache.project.data = body.data;
	}

	private getCustomElementsFromServer(): Promise<Map<number, ElementType>> {
		if (!this.user.isLoggedIn) {
			return Promise.resolve(new Map());
		}
		return this.http.get<HttpResponseData<ComponentInfoResponse[]>>(environment.apiPrefix + '/api/project/get-all-components-info').pipe(
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
		return this.openProjectFromServer(id, true);
	}

	public async openProjectFromServer(id: number, emptyProjectOnFailure: boolean): Promise<Project> {
		// #!web
		window.history.pushState(null, null, `/board/${id}`);
		this._projectSource = 'server';
		if (this._cloudProjectCache.has(id))
			return Promise.resolve(this.projectFromServerResponse(this._cloudProjectCache.get(id)));
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`${environment.apiPrefix}/api/project/open/${id}`).pipe(
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
			}, emptyProjectOnFailure ? Project.empty() : undefined)
		).toPromise();
	}

	private projectFromServerResponse(openProResp: OpenProjectResponse): Project {
		if (Number(openProResp.project.is_component) === 1) {
			throw Error('isComp');
		}
		const id = Number(openProResp.project.pk_id);
		const project = this.convertResponseDataToProjectModel(openProResp.project.data);
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
				rotation: e.rotation,
				plugIndex: e.plugIndex
			};
			return elem;
		});
		return data;
	}

	private adjustInputsAndOutputs(project: ProjectModel): ProjectModel {
		project.board.elements = project.board.elements.map(el => {
			if (!this.elemProvService.isUserElement(el.typeId)) return el;
			const type = this.elemProvService.getElementById(el.typeId);
			el.numInputs = type.numInputs;
			el.numOutputs = type.numOutputs;

			let width;
			let height;
			if (el.rotation === 0 || el.rotation === 2) {
				width = 2;
				height = el.numInputs >= el.numOutputs ? el.numInputs : el.numOutputs;
			} else {
				width = el.numInputs >= el.numOutputs ? el.numInputs : el.numOutputs;
				height = 2;
			}

			el.endPos = new PIXI.Point(el.pos.x + width, el.pos.y + height);
			return el;
		});
		return project;
	}
}
