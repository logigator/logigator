import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {Observable, of, ReplaySubject, Subject} from 'rxjs';
import {Action} from '../../models/action';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {delayWhen, tap} from 'rxjs/operators';
import {WorkArea} from '../../models/rendering/work-area';
import {SaveAsComponent} from '../../components/popup/popup-contents/save-as/save-as.component';
import {PopupService} from '../popup/popup.service';
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

	private _projectOpenedSubject = new ReplaySubject<number>();
	private _projectClosedSubject = new Subject<number>();
	private _projectSwitchSubject = new Subject<number>();

	constructor(
		private projectSaveManagementService: ProjectSaveManagementService,
		private popup: PopupService,
		private elementProvider: ElementProviderService
	) {
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
		if (this.allProjects.has(id)) {
			this.switchToProject(id);
			return;
		}
		if (this._currentlyOpening.includes(id)) return;
		this._currentlyOpening.push(id);
		const proj = await this.projectSaveManagementService.openComponent(id);
		if (!proj) {
			this._currentlyOpening = this._currentlyOpening.filter(o => id !== o);
			return;
		}
		this._projects.set(id, proj);
		this._projectOpenedSubject.next(id);
		this._currentlyOpening = this._currentlyOpening.filter(o => id !== o);
	}

	public inputsOutputsCustomComponentChanged(projectId: number) {
		const compProject = this.allProjects.get(projectId);
		if (!compProject || compProject.type !== 'comp') return;
		const elemType = this.elementProvider.getElementById(projectId);
		compProject.currState.inputOutputCount();
		elemType.minInputs = compProject.numInputs;
		elemType.maxInputs = compProject.numInputs;
		elemType.numInputs = compProject.numInputs;
		elemType.numOutputs = compProject.numOutputs;
		this._projects.forEach(p => p.updateInputsOutputs(projectId));
	}

	public newProject() {
		this.projectSaveManagementService.resetProjectSource();
		const project = Project.empty();
		this.allProjects.forEach((value, key) => this.closeProject(key));
		this._projects.set(project.id, project);
		this._currProject = project;
		this._mainProject = project;
		this._projectOpenedSubject.next(project.id);
	}

	public openFile(content: string) {
		const project = this.projectSaveManagementService.openFromFile(content);
		if (!project) return;
		this.allProjects.forEach((value, key) => this.closeProject(key));
		this._projects.set(project.id, project);
		this._currProject = project;
		this._mainProject = project;
		this._projectOpenedSubject.next(project.id);
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
				return of(undefined);
			})
		);
	}

	public get onProjectClosed$(): Observable<number> {
		return this._projectClosedSubject.asObservable();
	}

	public get onProjectSwitch$(): Observable<number> {
		return this._projectSwitchSubject.asObservable();
	}

	public switchToProject(id: number): void {
		this._currProject = this._projects.get(id);
		this._projectSwitchSubject.next(id);
	}

	public get currProject(): Project {
		return this._currProject;
	}

	public get allProjects(): Map<number, Project> {
		return this._projects;
	}

	public closeProject(id: number) {
		this.projectSaveManagementService.saveComponent(this._projects.get(id)).then(() => {
			this._projectClosedSubject.next(id);
			this._projects.delete(id);
		}).catch();
	}

	public async saveAll() {
		if (this.projectSaveManagementService.isFirstSave) {
			const newMainProject = await this.popup.showPopup(SaveAsComponent, 'Save Project', false, Array.from(this.allProjects.values()));
			if (newMainProject) {
				this.allProjects.forEach((value, key) => this.closeProject(key));
				this._mainProject = newMainProject;
				this._projects.set(newMainProject.id, newMainProject);
				this._projectOpenedSubject.next(newMainProject.id);
			}
		} else {
			await this.projectSaveManagementService.saveProjects(Array.from(this.allProjects.values()));
		}
	}

	public getProjectById(id: number): Project {
		return this._projects.get(id);
	}
}
