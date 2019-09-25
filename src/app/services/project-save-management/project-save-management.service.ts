import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {OpenProjectResponse} from '../../models/http-responses/open-project-response';
import {catchError, map} from 'rxjs/operators';
import {ProjectModel} from '../../models/project-model';
import * as PIXI from 'pixi.js';
import {HttpClient} from '@angular/common/http';
import {ElementType} from '../../models/element-type';
import {Element} from '../../models/element';
import {ComponentInfoResponse} from '../../models/http-responses/component-info-response';
import {ProjectState} from '../../models/project-state';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {UserService} from '../user/user.service';
import {Observable} from 'rxjs';
import {ErrorHandlingService} from '../error-handling/error-handling.service';

@Injectable({
	providedIn: 'root'
})
export class ProjectSaveManagementService {

	private _projectSource: 'server' | 'share' | 'file';

	constructor(
		private http: HttpClient,
		private elemProvService: ElementProviderService,
		private user: UserService,
		private errorHandling: ErrorHandlingService
	) { }

	public async getProjectToOpenOnLoad(): Promise<Project> {
		let project;
		if (location.pathname === '/') {
			project = Promise.resolve(this.createEmptyProject());
			this.elemProvService.setUserDefinedTypes(await this.getAllAvailableCustomElements());
		} else {
			project = this.openProjectFromServer();
			this.elemProvService.setUserDefinedTypes(await this.getAllAvailableCustomElements());
		}
		return project;
	}

	public async getAllAvailableCustomElements(): Promise<Map<number, ElementType>> {
		let elemMap = new Map<number, ElementType>();
		if (this.user.isLoggedIn) {
			elemMap = await this.getComponentsFromServer().toPromise();
		}
		return elemMap;
	}

	private getComponentsFromServer(): Observable<Map<number, ElementType>> {
		return this.http.get<HttpResponseData<ComponentInfoResponse[]>>('/api/project/get-all-components-info').pipe(
			map(data => {
				const newElemTypes = new Map<number, ElementType>();
				data.result.forEach(elem => {
					const elemType: ElementType = {
						description: elem.description,
						name: elem.name,
						rotation: 0,
						hasVariableInputs: false,
						symbol: elem.symbol,
						numInputs: 2,
						numOutputs: 1,
						category: 'user'
					};
					newElemTypes.set(elem.pk_id, elemType);
				});
				return newElemTypes;
			}),
			this.errorHandling.catchErrorOperator('Cannot get Components from Server', new Map<number, ElementType>()),
		);
	}

	public save(projects: Project[]) {
		if (!this._projectSource) {
			this.saveAs();
			return;
		}

		if (this._projectSource === 'server') {
			this.saveProjectsToServer(projects);
		}
	}

	public saveAs() {
	}

	private saveProjectsToServer(projects: Project[]): Promise<any> {
		const allPromises = [];
		projects.forEach(proj => {
			allPromises.push(this.saveSingleProject(proj));
		});
		return Promise.all(allPromises);
	}

	private saveSingleProject(project: Project): Promise<HttpResponseData<{success: boolean}>> {
		return this.http.post<HttpResponseData<{success: boolean}>>(`/api/project/save/${project.id}`, {
			data: project.currState.model
		}).toPromise();
	}

	public openComponent(id: number): Promise<Project> {
		if (this._projectSource === 'server') {
			return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
				map(response => {
					if (Number(response.result.project.is_component) === 0) {
						throw Error('isProj');
					}
					const project = this.getProjectModelFromJson(response.result.project.data);
					return new Project(new ProjectState(project), {
						id,
						name: response.result.project.name,
						type: 'comp'
					});
				}),
				this.errorHandling.catchErrorOperatorDynamicMessage((err: any) => {
					if (err === 'isProj') return 'Unable to open Project as Component';
					return err.error.error.description;
				}, undefined)
			).toPromise();
		}
		return Promise.resolve() as any;
	}

	private createEmptyProject(): Project {
		return new Project(new ProjectState(), {
			type: 'project',
			name: 'New Project',
			id: 0
		});
	}

	private openProjectFromServer(): Promise<Project> {
		const path = location.pathname;
		if (!path.startsWith('/board/')) {
			return Promise.reject('Invalid Url');
		}
		const id = Number(path.substr(path.lastIndexOf('/') + 1));
		if (Number.isNaN(id)) {
			return Promise.reject('Invalid Url');
		}
		this._projectSource = 'server';
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
			map(response => {
				if (Number(response.result.project.is_component) === 1) {
					throw Error('isComp');
				}
				const project = this.getProjectModelFromJson(response.result.project.data);
				return new Project(new ProjectState(project), {
					id,
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
				return err.error.error.description;
			}, this.createEmptyProject())
		).toPromise();
	}

	private getProjectModelFromJson(data: any): ProjectModel {
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
