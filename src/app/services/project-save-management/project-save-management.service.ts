import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {OpenProjectResponse} from '../../models/http-responses/open-project-response';
import {catchError, map} from 'rxjs/operators';
import {ProjectModel} from '../../models/project-model';
import * as PIXI from 'pixi.js';
import {HttpClient} from '@angular/common/http';
import {ElementType} from '../../models/element-type';
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

@Injectable({
	providedIn: 'root'
})
export class ProjectSaveManagementService {

	private _projectSource: 'server' | 'share';
	private _componentsFromLocalFile = new Map<number, ComponentLocalFile>();

	constructor(
		private http: HttpClient,
		private elemProvService: ElementProviderService,
		private user: UserService,
		private errorHandling: ErrorHandlingService
	) { }

	public async getProjectToOpenOnLoad(): Promise<Project> {
		let project;
		if (location.pathname.startsWith('/board')) {
			project = this.openProjectFromServerOnLoad();
			this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
		} else if (location.pathname.startsWith('/share')) {
			// open share
		} else {
			project = Promise.resolve(this.createEmptyProject());
			this.elemProvService.setUserDefinedTypes(await this.getCustomElementsFromServer());
		}
		return project;
	}

	public get isFirstSave(): boolean {
		return !this._projectSource;
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
			if (!id) return;
		} else {
			// TODO: create component in local map
		}
	}

	public openFromFile(content: string): Project {
		let parsedFile: ProjectLocalFile;
		try {
			parsedFile = JSON.parse(content);
		} catch (e) {
			this.errorHandling.showErrorMessage('Invalid File');
			return;
		}
		this.elemProvService.clearElementsFromFile();
		parsedFile.components.forEach(c => {
			this._componentsFromLocalFile.set(c.typeId, c);
			this.elemProvService.addUserDefinedElement(c.type, c.typeId);
		});
		const mainModel = this.getProjectModelFromJson(parsedFile.mainProject.data as ProjectModelResponse);
		return new Project(new ProjectState(mainModel), {
			type: 'project',
			name: parsedFile.mainProject.name,
			id: parsedFile.mainProject.id
		});
	}

	public async exportToFile(allOpenProjects: Project[], name?: string) {
		const mainProject = allOpenProjects.find(p => p.type === 'project');
		const deps = Array.from((await this.buildDependencyTree(mainProject, new Map<number, Project>())).values());
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
				return {
					typeId: mapping.find(m => m.model === c.id).database,
					data: this.applyMappingsLoad(c.currState.model, mapping),
					type
				} as ComponentLocalFile;
			}) as ComponentLocalFile[]
		};
		const blob = new Blob([JSON.stringify(modelToSave, null, 2)], {type: 'application/json;charset=utf-8'});
		FileSaver.saveAs(blob, `${mainProject.name}.json`);
	}

	private async buildDependencyTree(project: Project, resolved: Map<number, Project>): Promise<Map<number, Project>> {
		for (const element of project.currState.model.board.elements) {
			if (element.typeId >= 500 && !resolved.has(element.typeId)) {
				const proj = await this.openComponent(element.typeId);
				resolved.set(element.typeId, proj);
				resolved = new Map([...resolved, ...(await this.buildDependencyTree(proj, resolved))]);
			}
		}
		return resolved;
	}

	public async saveAsNewProjectServer(projects: Project[], name: string): Promise<Project> {
		const mainProject = projects.find(p => p.type === 'project');
		const components = projects.filter(p => p.type === 'comp');
		// TODO: build dependency tree and if comp is found on server update, if not create, map all ids to new database ids
		const newId = await this.createProjectServer(name);
		if (!newId) return;
		this._projectSource = 'server';
		const newProject = new Project(new ProjectState(mainProject.currState.model), {
			name,
			id: newId,
			type: 'project'
		});
		newProject.dirty = true;
		try {
			await this.saveProjects([newProject]);
			this.saveProjects(components);
			return newProject;
		} catch (e) {
			delete this._projectSource;
			this.errorHandling.showErrorMessage('Unable to save new Project');
			return null;
		}
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

	public async saveProjects(projects: Project[]) {
		if (this._projectSource === 'server') {
			await this.saveProjectsToServer(projects);
		}
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
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
			map(response => {
				if (Number(response.result.project.is_component) === 0) {
					throw Error('isProj');
				}
				let project = this.getProjectModelFromJson(response.result.project.data);
				project = this.applyMappingsLoad(project, response.result.project.data.mappings);
				project = this.removeMappingsFromModel(project as ProjectModelResponse);
				return new Project(new ProjectState(project), {
					id: Number(id),
					name: response.result.project.name,
					type: 'comp'
				});
			}),
			this.errorHandling.catchErrorOperatorDynamicMessage((err: any) => {
				if (err.message === 'isProj') return 'Unable to open Project as Component';
				return err.error.error.description;
			}, undefined)
		).toPromise();
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
			map(response => response.result.id),
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
			body.num_inputs = 1;
			body.num_outputs = 1;
		}
		return this.http.post<HttpResponseData<{success: boolean}>>(`/api/project/save/${project.id}`, body).toPromise();
	}

	private getCustomElementsFromServer(): Promise<Map<number, ElementType>> {
		if (!this.user.isLoggedIn) {
			this.errorHandling.showErrorMessage('Cannot get Components, Not logged in');
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
			return Promise.resolve(this.createEmptyProject());
		}
		return this.openProjectFromServer(id);
	}

	private async openProjectFromServer(id: number): Promise<Project> {
		this._projectSource = 'server';
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
			map(response => {
				if (Number(response.result.project.is_component) === 1) {
					throw Error('isComp');
				}
				let project = this.getProjectModelFromJson(response.result.project.data);
				project = this.applyMappingsLoad(project, response.result.project.data.mappings);
				project = this.removeMappingsFromModel(project as ProjectModelResponse);
				return new Project(new ProjectState(project), {
					id: Number(id),
					name: response.result.project.name,
					type: 'project'
				});
			}),
			catchError(err => {
				if (err === 'isComp') {
					delete this._projectSource;
				}
				throw err;
			}),
			this.errorHandling.catchErrorOperatorDynamicMessage((err: any) => {
				if (err === 'isComp') return 'Unable to open Component as Project';
				return err;
			}, this.createEmptyProject())
		).toPromise();
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

	private createEmptyProject(): Project {
		return new Project(new ProjectState(), {
			type: 'project',
			name: 'NewProject',
			id: 0
		});
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
