import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {ProjectState} from '../../models/project-state';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {ProjectModel} from '../../models/project-model';
import {Element} from '../../models/element';
import * as PIXI from 'pixi.js';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {OpenProjectResponse} from '../../models/http-responses/open-project-response';


@Injectable({
	providedIn: 'root'
})
export class ProjectResolveService {

	constructor(private http: HttpClient) {}

	public getProjectToOpenOnLoad(): Promise<Project> {
		if (location.pathname === '/') {
			return this.createEmptyProject();
		} else {
			return this.openProject();
		}
	}

	public openComponent(id: number): Promise<Project> {
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
			map(response => {
				const project = this.getProjectModelFromJson(response.result.project.data);
				return new Project(new ProjectState(project), {
					id,
					name: response.result.project.name,
					type: 'comp'
				});
			})
		).toPromise();
	}

	private createEmptyProject(): Promise<Project> {
		return Promise.resolve(new Project(new ProjectState(), {
			type: 'project',
			name: 'New Project',
			id: 0
		}));
	}

	private openProject(): Promise<Project> {
		const path = location.pathname;
		if (!path.startsWith('/board/')) {
			return Promise.reject('Invalid Url');
		}
		const id = Number(path.substr(path.lastIndexOf('/') + 1));
		if (Number.isNaN(id)) {
			return Promise.reject('Invalid Url');
		}
		return this.http.get<HttpResponseData<OpenProjectResponse>>(`/api/project/open/${id}`).pipe(
			map(response => {
				const project = this.getProjectModelFromJson(response.result.project.data);
				return new Project(new ProjectState(project), {
					id,
					name: response.result.project.name,
					type: 'project'
				});
			})
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
				inputs: e.inputs,
				outputs: e.outputs,
				pos: new PIXI.Point(e.posX, e.posY),
				endPos: new PIXI.Point(e.endX, e.endY)
			};
			return elem;
		});
		return data;
	}
}
