import {Inject, Injectable} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {BehaviorSubject, Observable} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {ProjectsService} from '../projects/projects.service';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {
	WorkerCommunicationService,
	WorkerCommunicationServiceModel
} from '../simulation/worker-communication/worker-communication-service';
import {TranslateService} from '@ngx-translate/core';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {

	private _currentWorkMode: WorkMode = WorkMode.SELECT;

	private _currentWorkModeSubject = new BehaviorSubject<WorkMode>(WorkMode.SELECT);

	private _currentComponentTypeToBuild: number = undefined;

	constructor(
		private projects: ProjectsService,
		private projectSaveManagement: ProjectSaveManagementService,
		private elemProv: ElementProviderService,
		@Inject(WorkerCommunicationService) private workerCommunicationService: WorkerCommunicationServiceModel,
		private translate: TranslateService,
	) {}

	public setWorkMode(workMode: WorkMode, compToBuild?: number) {
		this._currentComponentTypeToBuild = compToBuild;
		this._currentWorkMode = workMode;
		this._currentWorkModeSubject.next(workMode);
	}

	public enterSimulation() {
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

	public leaveSimulation() {
		// this.renderTicker.stopAllContSim();
		// this._currentWorkMode = 'select';
		// this._workModeSubject.next('select');
		// this.workerCommunicationService.stop();
		// delete this._currentComponentTypeToBuild;
	}

	public get currentWorkMode(): WorkMode {
		return this._currentWorkMode;
	}

	public get currentWorkMode$(): Observable<WorkMode> {
		return this._currentWorkModeSubject.asObservable();
	}

	public get workModeDescription$(): Observable<string> {
		return this._currentWorkModeSubject.pipe(
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
