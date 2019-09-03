import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {Observable} from 'rxjs';
import {Action} from '../../models/action';

@Injectable({
	providedIn: 'root'
})
export class ProjectsService {

	private projects: Project[];
	private _currProject: Project;

	constructor() { }

	public subscribeToChanges(id: number): Observable<Action> {
		return this.projects.find(p => p.id === id).changes;
	}

	public switchToProject(id: number): void {
		this._currProject = this.projects.find(p => p.id === id);
	}

	get currProject(): Project {
		return this._currProject;
	}
}
