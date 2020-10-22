import {Inject, Injectable} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {Observable, ReplaySubject} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ProjectsService} from '../projects/projects.service';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {
	WorkerCommunicationService,
	WorkerCommunicationServiceModel
} from '../simulation/worker-communication/worker-communication-service';
import {TranslateService} from '@ngx-translate/core';
import {HelpWindowService} from '../help-window/help-window.service';
import {EditorActionsService} from '../editor-actions/editor-actions.service';
import {EditorAction} from '../../models/editor-action';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {

	private _currentWorkMode: WorkMode = WorkMode.SELECT;

	private _workModeSubject = new ReplaySubject<WorkMode>(1);

	private _currentComponentTypeToBuild: number = undefined;


	constructor(
		private projects: ProjectsService,
		private projectSaveManagement: ProjectSaveManagementService,
		private elemProv: ElementProviderService,
		@Inject(WorkerCommunicationService) private workerCommunicationService: WorkerCommunicationServiceModel,
		private translate: TranslateService,
		private helpWindowService: HelpWindowService,
		private editorActions: EditorActionsService
	) {
		this.editorActions.subscribe().subscribe(event => this.onEditorAction(event.action, event.data));
	}

	private onEditorAction(action: EditorAction, data?: any) {
		switch (action) {
			case EditorAction.SWITCH_MODE_SELECT:
				this.switchWorkMode(WorkMode.SELECT);
				break;
			case EditorAction.SWITCH_MODE_CUT_SELECT:
				this.switchWorkMode(WorkMode.CUT_SELECT);
				break;
			case EditorAction.SWITCH_MODE_ERASER:
				this.switchWorkMode(WorkMode.ERASER);
				break;
			case EditorAction.SWITCH_MODE_TEXT:
				this.switchWorkMode(WorkMode.TEXT);
				break;
			case EditorAction.SWITCH_MODE_WIRE:
				this.switchWorkMode(WorkMode.WIRE);
				break;
			case EditorAction.SWITCH_MODE_CONN_WIRE:
				this.switchWorkMode(WorkMode.CONN_WIRE);
				break;
			case EditorAction.SWITCH_MODE_COMPONENT:
				this.switchWorkMode(WorkMode.COMPONENT);
				this._currentComponentTypeToBuild = data;
				break;
			case EditorAction.ENTER_SIM:
				this.enterSimulation();
				break;
			case EditorAction.LEAVE_SIM:
				this.leaveSimulation();
				break;
		}
	}

	private switchWorkMode(workMode: WorkMode) {
		this._currentWorkMode = workMode;
		this._workModeSubject.next(workMode);
	}

	private async enterSimulation() {
		this.switchWorkMode(WorkMode.SIMULATION);
			// if (!this.projectSaveManagement.isShare) {
		// 	await this.projects.saveAllOrAllComps();
		// } else {
		// 	this.projects.saveComponentsShare();
		// }
		// try {
		// 	await this.workerCommunicationService.init();
		// 	this._currentWorkMode = 'simulation';
		// 	this._workModeSubject.next('simulation');
		// 	delete this._currentComponentTypeToBuild;
		// 	this.helpWindowService.showHelpWindow('ENTER_SIM');
		// } catch (e) {}
	}

	private leaveSimulation() {
		this.editorActions.triggerAction(EditorAction.SWITCH_MODE_SELECT);
		// this.renderTicker.stopAllContSim();
		// this._currentWorkMode = 'select';
		// this._workModeSubject.next('select');
		// this.workerCommunicationService.stop();
		// delete this._currentComponentTypeToBuild;
	}

	public get currentWorkMode(): WorkMode {
		return this._currentWorkMode;
	}

	public get workModeDescription$(): Observable<string> {
		return this._workModeSubject.pipe(
			switchMap(workMode => {
				if (workMode === WorkMode.COMPONENT) {
					return this.translate.get(this.elemProv.getElementById(this._currentComponentTypeToBuild).name).pipe(
						switchMap(comp => {
							return this.translate.get('WORK_MODE_DES.' + workMode, {comp});
						})
					);
				}
				return this.translate.get('WORK_MODE_DES.' + workMode);
			})
		);
	}

	public get currentComponentToBuild(): number {
		return this._currentComponentTypeToBuild;
	}

	public get isCompToBuildPlug(): boolean {
		return this.elemProv.isPlugElement(this.currentComponentToBuild);
	}
}
