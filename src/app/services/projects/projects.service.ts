import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {Observable, ReplaySubject} from 'rxjs';
import {Action} from '../../models/action';
import {ProjectResolveService} from '../project-resolve/project-resolve.service';

@Injectable({
	providedIn: 'root'
})
export class ProjectsService {

	public static staticInstance: ProjectsService;

	private _projects: Map<number, Project> = new Map<number, Project>();
	private _currProject: Project;

	private _mainProject: Project;

	private _projectOpenedSubject = new ReplaySubject<number>(2);

	constructor(private projectsResolve: ProjectResolveService) {
		ProjectsService.staticInstance = this;

		this.projectsResolve.getProjectToOpenOnLoad().then(project => {
			this._projects.set(project.id, project);
			this._projectOpenedSubject.next(project.id);
			this._currProject = project;
			this._mainProject = project;
		}).catch(e => console.log(e));
	}

	public get mainProjectInfo(): Project {
		return this._mainProject;
	}

	public async openComponent(id: number) {
		if (this.allProjects.has(id)) return;
		const project = await this.projectsResolve.openComponent(id);
		this._projects.set(id, project);
		this._projectOpenedSubject.next(id);
	}

	public onProjectChanges$(projectId: number): Observable<Action[]> {
		console.log(this._projects);
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
