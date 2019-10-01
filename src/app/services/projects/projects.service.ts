import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {EMPTY, Observable, ReplaySubject} from 'rxjs';
import {Action} from '../../models/action';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {delayWhen} from 'rxjs/operators';
import {WorkArea} from '../../models/rendering/work-area';
import {ProjectState} from '../../models/project-state';
import {TestModel} from '../../models/tests/test-model';

@Injectable({
	providedIn: 'root'
})
export class ProjectsService {

	public static staticInstance: ProjectsService;

	private _projects: Map<number, Project> = new Map<number, Project>();
	private _currProject: Project;

	private _mainProject: Project;

	private _currentlyOpening: number[] = [];

	private _projectOpenedSubject = new ReplaySubject<number>(2);

	constructor(private projectSaveManagementService: ProjectSaveManagementService) {
		ProjectsService.staticInstance = this;

		// const main = new Project(new ProjectState(TestModel.mainModel), {id: 1000, name: 'main', type: 'project'});
		// const comp = new Project(new ProjectState(TestModel.compModel), {id: 1001, name: 'mycomp', type: 'comp'});
		const main = Project.empty('main');
		const comp = Project.empty('mycomp');
		comp.type = 'comp';
		this._projects.set(1000, main);
		this._projects.set(1001, comp);
		this._projectOpenedSubject.next(1000);
		this._projectOpenedSubject.next(1001);

		this._mainProject = main;
		this._currProject = main;

		this.projectSaveManagementService.getProjectToOpenOnLoad().then(project => {
			this._projects.set(project.id, project);
			this._currProject = project;
			this._mainProject = project;
			this._projectOpenedSubject.next(project.id);
		});
	}

	public get mainProject(): Project {
		return this._mainProject;
	}

	public async openComponent(id: number) {
		if (this.allProjects.has(id) || this._currentlyOpening.includes(id)) return;
		this._currentlyOpening.push(id);
		const proj = await this.projectSaveManagementService.openComponent(id);
		this._projects.set(id, proj);
		this._projectOpenedSubject.next(id);
		this._currentlyOpening = this._currentlyOpening.filter(o => id !== o);
	}

	public onProjectChanges$(projectId: number): Observable<Action[]> {
		return this._projects.get(projectId).changes;
	}

	public get onProjectOpened$(): Observable<number> {
		return this._projectOpenedSubject.asObservable().pipe(
			delayWhen((value, index) => {
				if (index === 0) {
					return WorkArea.pixiFontLoaded$;
				}
				return EMPTY;
			})
		);
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

	public saveAll() {
		this.projectSaveManagementService.save(Array.from(this.allProjects.values()));
	}

	public getProjectById(id: number): Project {
		return this._projects.get(id);
	}
}
