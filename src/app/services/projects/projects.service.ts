import { Injectable } from '@angular/core';
import {Project} from '../../models/project';

@Injectable({
	providedIn: 'root'
})
export class ProjectsService {

	private projects: Project[];
	private _currProject: Project;

	constructor() { }

	get currProject(): Project {
		return this._currProject;
	}
}
