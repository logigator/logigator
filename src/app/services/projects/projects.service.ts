import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {Observable, ReplaySubject} from 'rxjs';
import {Action} from '../../models/action';
import {ProjectState} from '../../models/project-state';
import {TestModel} from '../../models/tests/test-model';

@Injectable({
	providedIn: 'root'
})
export class ProjectsService {

	public static staticInstance: ProjectsService;

	private _projects: Map<number, Project> = new Map<number, Project>();
	private _currProject: Project;

	private _projectOpenedSubject = new ReplaySubject<number>(2);

	constructor() {
		ProjectsService.staticInstance = this;
		const project = new Project(new ProjectState(), 0, 'Projekt', 'project');
		const project2 = new Project(new ProjectState(TestModel.basicModel), 2, 'Komponente 1');

		this._projects.set(0, project);
		this._projectOpenedSubject.next(0);
		this._currProject = project;

		// to simulate that the project was opened later, for testing
		setTimeout(() => {
			this._projects.set(2, project2);
			this._projectOpenedSubject.next(2);
			this._currProject = project2;
		}, 10);
	}

	public onProjectChanges$(projectId: number): Observable<Action[]> {
		return this._projects.get(projectId).changes;
	}

	public get onProjectOpened$(): Observable<number> {
		return this._projectOpenedSubject.asObservable();
	}

	public switchToProject(id: number): void {
		this._currProject = this._projects.get(id);
	}

	public get currProject(): Project {
		return this._currProject;
	}

	public get allProjects(): Map<number, Project> {
		return this._projects;
	}

	public closeProject(id: number) {
		this._projects.delete(id);
	}
}
