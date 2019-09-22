import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {ProjectState} from '../../models/project-state';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {HttpResponseData} from '../../models/http-response-data';
import {ProjectModel} from '../../models/project-model';
import {Element} from '../../models/element';
import * as PIXI from 'pixi.js';


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

	private createEmptyProject(): Promise<Project> {
		return Promise.resolve(new Project(new ProjectState(), {
			type: 'project',
			name: 'New Project'
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
		return this.http.post<HttpResponseData<{project: string}>>(`/api/project/open`, {id}).pipe(
			map(response => {
				const project = this.getProjectModelFromJson(response.result.project);
				return new Project(new ProjectState(project), {
					id,
					name: 'jaa'
				});
			})
		).toPromise();
	}

	private getProjectModelFromJson(data: any): ProjectModel {
		data = JSON.parse(data);
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
