import { Injectable } from '@angular/core';
import { Project } from '../../classes/project/project';
@Injectable({
	providedIn: 'root'
})
export class ProjectService {
	private _project: Project;

	constructor() {
		this._project = new Project();
	}

	public get project(): Project {
		return this._project;
	}
}
