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
import {PopupService} from '../popup/popup.service';
import {LocationService} from '../location/location.service';
import {SelectionService} from '../selection/selection.service';
import {CopyService} from '../copy/copy.service';
import {PixiLoaderService} from '../pixi-loader/pixi-loader.service';
import {addWarning} from '@angular-devkit/build-angular/src/utils/webpack-diagnostics';

@Injectable({
	providedIn: 'root'
})
export class ProjectsService {

	private _projects: Project[] = [];

	private _mainProject: Project;

	private _currProject: Project;

	private _projectOpenedSubject = new ReplaySubject<number>();
	private _projectClosedSubject = new Subject<number>();
	private _projectSwitchSubject = new Subject<number>();
	private _userDefinedElementsReloadSubject = new Subject<void>();

	constructor(
		private projectSaveManagementService: ProjectSaveManagementService,
		private popup: PopupService,
		private elementProvider: ElementProviderService,
		private errorHandling: ErrorHandlingService,
		private pixiLoader: PixiLoaderService,
		private location: LocationService
	) {
		this.projectSaveManagementService.getInitialProjects().then(projects => {
			this._projects = projects;
			this._mainProject = projects[0];
			this._currProject = projects[0];
			for (const p of this.allProjects) {
				this._projectOpenedSubject.next(p.id);
			}
		});
	}

	public get allProjects(): Project[] {
		return this._projects;
	}

	public get mainProject(): Project {
		return this._mainProject;
	}

	public get currProject(): Project {
		return this._currProject;
	}

	public getProjectById(id: number): Project {
		return this._projects.find(p => p.id === id);
	}

	public get onProjectOpened$(): Observable<number> {
		return this._projectOpenedSubject.asObservable().pipe(
			delayWhen((value, index) => this.pixiLoader.loaded$)
		);
	}

	public get onProjectClosed$(): Observable<number> {
		return this._projectClosedSubject.asObservable();
	}

	public get onProjectSwitch$(): Observable<number> {
		return this._projectSwitchSubject.asObservable();

	}

	public get onUserDefinedElementsReload$(): Observable<void> {
		return this._userDefinedElementsReloadSubject.asObservable();
	}

	public switchToProject(id: number) {
		this._currProject = this.getProjectById(id);
		this._projectSwitchSubject.next(id);
	}

	public async closeProject(id: number) {
		await this.saveProject(id);
		this._projects = this._projects.filter(p => p.id !== id);
		this._projectClosedSubject.next(id);
	}

	private async saveProject(id: number) {
		const project = this.getProjectById(id);
		switch (project.type) {
			case 'comp':
				await this.projectSaveManagementService.saveComponent(project);
				break;
			case 'project':
				await this.projectSaveManagementService.saveProject(project);
				break;
		}
	}

	private async openNewProject(project: Project) {
		this._mainProject = project;
		for (const p of this._projects) {
			await this.closeProject(p.id);
		}
		this._projects.push(project);
		this._projectOpenedSubject.next(project.id);
	}

	public async saveAllProjects() {
		for (const p of this.allProjects) {
			await this.saveProject(p.id);
		}
	}

	public async createComponent(name: string, symbol: string, description: string = '') {
		try {
			const component = await this.projectSaveManagementService.createComponent(name, symbol, description);
			this._projects.push(component);
			this._projectOpenedSubject.next(component.id);
			this.errorHandling.showInfo('INFO.PROJECTS.CREATE_COMP', {name});
		} catch {}
	}

	public async openProjectUuid(id: string) {
		this.projectSaveManagementService.clearElements('share');
		try {
			const project = await this.projectSaveManagementService.getProjectOrComponentUuid(id, 'project');
			await this.openNewProject(project);
			this.location.set('project', id);
			this.errorHandling.showInfo('INFO.PROJECTS.OPEN', {name: project.name});
		} catch {}
	}

	public async openComponent(id: number) {
		if (this.getProjectById(id)) {
			this.switchToProject(id);
			return;
		}

		try {
			const component = await this.projectSaveManagementService.getComponent(id);
			this._projects.push(component);
			this._projectOpenedSubject.next(component.id);
		} catch {}
	}

	public async saveProjectServer(name: string, description = '') {
		try {
			const newId = await this.projectSaveManagementService.createProjectServer(name, description, this._mainProject);
			const project = await this.projectSaveManagementService.getProjectOrComponentUuid(newId, 'project');
			this._projects.unshift(project);
			this._projectOpenedSubject.next(project.id);
			this._mainProject = project;
			for (let i = 1; i < this._projects.length; i++) {
				this._projectClosedSubject.next(this._projects[i].id);
			}
			this._projects = [this._projects[0]];
			this.location.set('project', newId);
			this.errorHandling.showInfo('INFO.PROJECTS.SAVE', {name});
		} catch {}
	}

	public async exportToFile(name?: string) {
		await this.projectSaveManagementService.exportToFile(this._mainProject, name);
		this.errorHandling.showInfo('INFO.PROJECTS.EXPORT_FILE', {name});
	}

	public async openFile(content: string) {
		this.projectSaveManagementService.clearElements('local');
		this.projectSaveManagementService.clearElements('share');
		try {
			const project = this.projectSaveManagementService.openFile(content);
			await this.openNewProject(project);
			this.location.reset();
			this.errorHandling.showInfo('INFO.PROJECTS.OPEN_FILE', {name: project.name});
		} catch {
			this.errorHandling.showErrorMessage('ERROR.PROJECTS.INVALID_FILE');
		}
	}

	public async openShare(linkId: string) {
		this.projectSaveManagementService.clearElements('share');
		try {
			const project = await this.projectSaveManagementService.getProjectShare(linkId);
			if (project.type === 'comp') {
				await this.openNewProject(this.projectSaveManagementService.getEmptyProject());
				this._projects.push(project);
				this._projectOpenedSubject.next(project.id);
			} else {
				await this.openNewProject(project);
			}
			this.location.set('share', linkId);
			this.errorHandling.showInfo('INFO.PROJECTS.OPEN_SHARE', {name: project.name});
		} catch {
			if (this.mainProject.source === 'share') {
				this.newProject();
			}
		}
	}

	public async newProject() {
		this.projectSaveManagementService.clearElements('share');
		const project = this.projectSaveManagementService.getEmptyProject();
		await this.openNewProject(project);
		this.location.reset();
	}

	public inputsOutputsCustomComponentChanged(project: Project) {
		if (project.type !== 'comp') return;
		const elemType = this.elementProvider.getElementById(project.id);
		project.currState.inputOutputCount();
		elemType.minInputs = project.numInputs;
		elemType.maxInputs = project.numInputs;
		elemType.numInputs = project.numInputs;
		elemType.numOutputs = project.numOutputs;
		this._projects.forEach(p => p.updateInputsOutputs(project.id));
		this.labelsCustomComponentChanged(project);
	}

	public labelsCustomComponentChanged(project: Project) {
		if (!project || project.type !== 'comp') return;
		const elemType = this.elementProvider.getElementById(project.id);
		elemType.labels = project.calcLabels();
		this._projects.forEach(p => p.updateLabels(project.id));
	}

	public async askToSave(): Promise<boolean> {
		if (!this.hasUnsavedProjects)
			return true;
		return await this.popup.showPopup(UnsavedChangesComponent, 'POPUP.UNSAVED_CHANGES.TITLE', false);
	}

	public get hasUnsavedProjects(): boolean {
		for (const project of this._projects) {
			if (project.saveDirty) return true;
		}
		return false;
	}


	public moveProjectToIndex(project: Project, index: number) {
		const projects = this._projects.filter(p => p !== project);
		projects.splice(index, 0, project);
		this._projects = projects;
	}

	public async reloadUserElements() {
		await this.projectSaveManagementService.getAllComponentsInfo();
		this._userDefinedElementsReloadSubject.next();
		this.errorHandling.showInfo('INFO.PROJECTS.RELOADED_ELEMENTS');
	}

	public async cloneShare() {
		if (this._mainProject.source !== 'share') return;
		try {
			const project = await this.projectSaveManagementService.cloneProjectShare(this._mainProject);
			this.projectSaveManagementService.clearElements('share');
			await this.openNewProject(project);
			this.location.set('project' , this.projectSaveManagementService.getUuidForProject(project.id));
			this.errorHandling.showInfo('INFO.PROJECTS.CLONE_SHARE', {name: project.name});
		} catch {}
	}
}
