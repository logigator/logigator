import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {EMPTY, Observable, ReplaySubject} from 'rxjs';
import {Action} from '../../models/action';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {delayWhen} from 'rxjs/operators';
import {WorkArea} from '../../models/rendering/work-area';
import {ElementProviderService} from '../element-provider/element-provider.service';

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

	public async newComponent(name: string, symbol: string) {
		if (!name)
			name = 'New Component';

		const elementProvider = ElementProviderService.staticInstance;
		let duplicate = 0;

		while (Array.from(elementProvider.userDefinedElements.values())
			.map(x => x.name)
			.includes((duplicate === 0) ? name : `${name}-${duplicate}`)) {
			duplicate++;
		}
		name = (duplicate === 0) ? name : `${name}-${duplicate}`;

		const id = await this.projectSaveManagementService.newComponent(name, symbol);
		if (!id)
			return;

		elementProvider.setUserDefinedTypes(elementProvider.userDefinedElements.set(id, {
			description: '',
			name,
			rotation: 0,
			minInputs: 0,
			maxInputs: 0,
			symbol,
			numInputs: 0,
			numOutputs: 0,
			category: 'user'
		}));
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
}
