import { Injectable } from '@angular/core';
import { ProjectMeta } from '../../classes/project/project-meta';
@Injectable({
	providedIn: 'root'
})
export class ProjectService {
	private _project: ProjectMeta;

	constructor() {
		this._project = new ProjectMeta();
	}

	public get project(): ProjectMeta {
		return this._project;
	}
}
