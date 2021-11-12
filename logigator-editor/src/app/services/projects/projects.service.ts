import {Injectable} from '@angular/core';
import {Project} from '../../models/project';
import {Observable, ReplaySubject, Subject} from 'rxjs';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {delayWhen} from 'rxjs/operators';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {UnsavedChangesComponent} from '../../components/popup-contents/unsaved-changes/unsaved-changes.component';
import {PopupService} from '../popup/popup.service';
import {LocationService} from '../location/location.service';
import {PixiLoaderService} from '../pixi-loader/pixi-loader.service';
import {LoadingService} from '../loading/loading.service';

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

	private _currentlyClosing = new Set<number>();
	private _currentlyOpening = new Set<number>();

	constructor(
		private projectSaveManagementService: ProjectSaveManagementService,
		private popup: PopupService,
		private elementProvider: ElementProviderService,
		private errorHandling: ErrorHandlingService,
		private pixiLoader: PixiLoaderService,
		private location: LocationService,
		private loadingService: LoadingService
	) {
		const removeLoading = this.loadingService.add('LOADING.OPENING_INITIAL_PROJECTS');
		this.projectSaveManagementService.getInitialProjects().then(projects => {
			this._projects = projects;
			this._mainProject = projects[0];
			this._currProject = projects[0];
			for (const p of this.allProjects) {
				this._projectOpenedSubject.next(p.id);
			}
			removeLoading();
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
		if (this._currentlyClosing.has(id))
			return;

		this._currentlyClosing.add(id);
		try {
			await this.saveProject(id);
			this._projects = this._projects.filter(p => p.id !== id);
			this._projectClosedSubject.next(id);
		} catch {} finally {
			this._currentlyClosing.delete(id);
		}
	}

	private async saveProject(id: number) {
		const project = this.getProjectById(id);
		const removeLoading = this.loadingService.add('LOADING.SAVE_PROJECT');
		switch (project.type) {
			case 'comp':
				await this.projectSaveManagementService.saveComponent(project);
				break;
			case 'project':
				await this.projectSaveManagementService.saveProject(project);
				break;
		}
		removeLoading();
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

	public async saveAllComponents() {
		for (const comp of this.allProjects.filter(p => p.type === 'comp')) {
			await this.saveProject(comp.id);
		}
	}

	public async createComponent(name: string, symbol: string, description: string = '', sharePublicly = false) {
		try {
			const component = await this.projectSaveManagementService.createComponent(name, symbol, description, sharePublicly);
			this._projects.push(component);
			this._projectOpenedSubject.next(component.id);
			this.errorHandling.showInfo('INFO.PROJECTS.CREATE_COMP', {name});
		} catch {}
	}

	public async openProjectUuid(id: string) {
		const removeLoading = this.loadingService.add('LOADING.OPEN_PROJECT');
		this.projectSaveManagementService.clearElements('share');
		try {
			const project = await this.projectSaveManagementService.getProjectOrComponentUuid(id, 'project');
			await this.openNewProject(project);
			this.location.set('project', id);
			this.errorHandling.showInfo('INFO.PROJECTS.OPEN', {name: project.name});
		} finally {
			removeLoading();
		}
	}

	public async openComponent(id: number) {
		if (this.getProjectById(id)) {
			this.switchToProject(id);
			return;
		}

		if (this._currentlyOpening.has(id))
			return;

		const removeLoading = this.loadingService.add('LOADING.OPEN_COMPONENT');
		this._currentlyOpening.add(id);
		try {
			const component = await this.projectSaveManagementService.getComponent(id);
			this._projects.push(component);
			this._projectOpenedSubject.next(component.id);
		} finally {
			this._currentlyOpening.delete(id);
			removeLoading();
		}
	}

	public async saveProjectServer(name: string, description = '', sharePublicly = false) {
		try {
			const newId = await this.projectSaveManagementService.createProjectServer(name, description, sharePublicly, this._mainProject);
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
		this.errorHandling.showInfo('INFO.PROJECTS.EXPORT_FILE', {name: name ?? this._mainProject.name});
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
		const removeLoading = this.loadingService.add('LOADING.OPEN_SHARE');
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
		} finally {
			removeLoading();
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
		const removeLoading = this.loadingService.add('LOADING.RELOAD_ELEMENTS');
		await this.projectSaveManagementService.getAllComponentsInfo();
		this._userDefinedElementsReloadSubject.next();
		this.errorHandling.showInfo('INFO.PROJECTS.RELOADED_ELEMENTS');
		removeLoading();
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
