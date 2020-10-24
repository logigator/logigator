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

	constructor(
		private projectSaveManagementService: ProjectSaveManagementService,
		private popup: PopupService,
		private elementProvider: ElementProviderService,
		private errorHandling: ErrorHandlingService,
		private location: LocationService
	) {
		this.getInitialProjects().then(() => {
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
		return this._projectOpenedSubject.asObservable();
	}

	public get onProjectClosed$(): Observable<number> {
		return this._projectClosedSubject.asObservable();
	}

	public get onProjectSwitch$(): Observable<number> {
		return this._projectSwitchSubject.asObservable();
	}

	public switchToProject(id: number) {
		this._currProject = this.getProjectById(id);
		this._projectSwitchSubject.next(id);
	}

	public closeProject(id: number) {
		// const project = this.getProjectById(id);
		this._projects = this._projects.filter(p => p.id !== id);
		this._projectClosedSubject.next(id);
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

	// TODO: Error handling
	private async getInitialProjects() {
		let projects: Project[];
		let mainProject: Project;
		if (this.location.isProject) {
			mainProject = await this.projectSaveManagementService.getProjectUuid(this.location.projectUuid);
			projects = [mainProject];
		} else if (this.location.isComponent) {
			const comp = await this.projectSaveManagementService.getComponentUuid(this.location.componentUuid);
			mainProject = Project.empty();
			projects = [mainProject, comp];
		} else if (this.location.isShare) {
			projects = [];
		} else {
			mainProject = Project.empty();
			projects = [mainProject];
		}
		this._projects = projects;
		this._mainProject = mainProject;
		this._currProject = mainProject;
	}
}
