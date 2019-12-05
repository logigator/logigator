import { Injectable } from '@angular/core';
import {Project} from '../../models/project';
import {Observable, ReplaySubject, Subject} from 'rxjs';
import {Action} from '../../models/action';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {delayWhen} from 'rxjs/operators';
import {WorkArea} from '../../models/rendering/work-area';
import {SaveAsComponent} from '../../components/popup-contents/save-as/save-as.component';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {UnsavedChangesComponent} from '../../components/popup-contents/unsaved-changes/unsaved-changes.component';
import {PopupService} from '@logigator/logigator-shared-comps';

@Injectable({
	providedIn: 'root'
})
export class ProjectsService {

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
		private elementProvider: ElementProviderService,
		private errorHandling: ErrorHandlingService
	) {
		this.projectSaveManagementService.getProjectsToOpenOnLoad().then(projects => {
			for (const p of projects) {
				if (this.projectSaveManagementService.projectSource === 'server')
					this.errorHandling.showInfo('INFO.PROJECTS.OPEN_PROJECT', {name: p.name});
				this._projects.set(p.id, p);
				this._currProject = p;
				if (p.type === 'project') this._mainProject = p;
				this._projectOpenedSubject.next(p.id);
			}
		});
	}

	public get mainProject(): Project {
		return this._mainProject;
	}

	public async openComponent(id: number) {
		if (this._projects.has(id)) {
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
		this.errorHandling.showInfo('INFO.PROJECTS.OPEN_COMP', {name: proj.name});
	}

	public inputsOutputsCustomComponentChanged(projectId: number) {
		const compProject = this._projects.get(projectId);
		if (!compProject || compProject.type !== 'comp') return;
		const elemType = this.elementProvider.getElementById(projectId);
		compProject.currState.inputOutputCount();
		elemType.minInputs = compProject.numInputs;
		elemType.maxInputs = compProject.numInputs;
		elemType.numInputs = compProject.numInputs;
		elemType.numOutputs = compProject.numOutputs;
		this._projects.forEach(p => p.updateInputsOutputs(projectId));
		this.labelsCustomComponentChanged(projectId);
	}

	public labelsCustomComponentChanged(projectId: number) {
		const compProject = this._projects.get(projectId);
		if (!compProject || compProject.type !== 'comp') return;
		const elemType = this.elementProvider.getElementById(projectId);
		elemType.labels = compProject.calcLabels();
		this._projects.forEach(p => p.updateLabels(projectId));
	}

	public get hasUnsavedProjects(): boolean {
		for (const project of this._projects.values()) {
			if (project.saveDirty) return true;
		}
		return false;
	}

	// returns if projects can be closed
	public async askToSave(): Promise<boolean> {
		if (!this.hasUnsavedProjects) return Promise.resolve(true);
		return await this.popup.showPopup(UnsavedChangesComponent, 'POPUP.UNSAVED_CHANGES.TITLE', false);
	}

	public async newProject() {
		if (!this.projectSaveManagementService.isShare) await this.saveAllOrAllComps();
		this.elementProvider.clearElementsFromFile();
		const project = Project.empty();
		this.closeAllProjects();
		this.projectSaveManagementService.projectSource = undefined;
		this._projects.set(project.id, project);
		this._currProject = project;
		this._mainProject = project;
		this._projectOpenedSubject.next(project.id);

		// #!web
		window.history.pushState(null, null, `/`);
	}

	public async openFile(content: string) {
		if (!this.projectSaveManagementService.isShare) await this.saveAllOrAllComps();
		const project = this.projectSaveManagementService.openFromFile(content);
		if (!project) return;
		this.switchProjectAfterOpen(project);
	}

	public async openProjectServer(id: number) {
		if (!this.projectSaveManagementService.isShare) await this.saveAllOrAllComps();
		const project = await this.projectSaveManagementService.getProjectOrCompFromServer(id, false);
		this.projectSaveManagementService.projectSource = 'server';
		// #!web
		window.history.pushState(null, null, `/board/${project.id}`);
		this.switchProjectAfterOpen(project);
	}

	private closeAllProjects() {
		for (const id of this._projects.keys()) {
			this._projectClosedSubject.next(id);
			this._projects.delete(id);
		}
	}

	public onProjectChanges$(projectId: number): Observable<Action[]> {
		return this._projects.get(projectId).changes;
	}

	public get onProjectOpened$(): Observable<number> {
		return this._projectOpenedSubject.asObservable().pipe(
			delayWhen((value, index) => {
				return WorkArea.pixiFontLoaded$;
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

	public async closeTab(id: number) {
		if (this.projectSaveManagementService.isShare) {
			this.projectSaveManagementService.saveComponentShare(this._projects.get(id));
		} else {
			await this.projectSaveManagementService.saveProject(this._projects.get(id));
		}
		this._projectClosedSubject.next(id);
		this._projects.delete(id);
	}

	public saveComponentsShare() {
		const comps = Array.from(this._projects.values()).filter(c => c.type === 'comp');
		for (const comp of comps) {
			this.projectSaveManagementService.saveComponentShare(comp);
		}
	}

	public async saveAll(): Promise<void> {
		if (this.projectSaveManagementService.isFirstSave) {
			await this.saveAllOrAllComps();
			const newMainProject = await this.popup.showPopup(SaveAsComponent, 'POPUP.SAVE.TITLE', false, this.mainProject);
			if (newMainProject) {
				this.closeAllProjects();
				this._mainProject = newMainProject;
				this._projects.set(newMainProject.id, newMainProject);
				this._projectOpenedSubject.next(newMainProject.id);
			}
		} else {
			await this.projectSaveManagementService.saveProjectsAndComponents(Array.from(this._projects.values()));
		}
	}

	public async saveAllOrAllComps() {
		if (!this.projectSaveManagementService.isFirstSave) {
			await this.saveAll();
		} else {
			await this.saveAllComponents();
		}
	}

	public saveAllComponents(): Promise<void> {
		const comps = Array.from(this._projects.values()).filter(c => c.type === 'comp');
		return this.projectSaveManagementService.saveProjectsAndComponents(comps);
	}

	public async cloneShare() {
		const projects = await this.projectSaveManagementService.cloneShare();
		if (!projects) return;
		this.closeAllProjects();
		for (const p of projects) {
			this.errorHandling.showInfo('INFO.PROJECTS.OPEN_PROJECT', {name: p.name});
			this._projects.set(p.id, p);
			this._currProject = p;
			if (p.type === 'project') this._mainProject = p;
			this._projectOpenedSubject.next(p.id);
		}
	}

	private switchProjectAfterOpen(project: Project) {
		if (!project) return;
		this.errorHandling.showInfo('INFO.PROJECTS.OPEN_PROJECT', {name: project.name});
		this.closeAllProjects();
		this._projects.set(project.id, project);
		this._currProject = project;
		this._mainProject = project;
		this._projectOpenedSubject.next(project.id);
	}

	public getProjectById(id: number): Project {
		return this._projects.get(id);
	}
}
