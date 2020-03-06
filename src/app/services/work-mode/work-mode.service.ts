import {Inject, Injectable} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {Observable, ReplaySubject} from 'rxjs';
import {distinctUntilChanged, map, switchMap} from 'rxjs/operators';
import {ProjectsService} from '../projects/projects.service';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {
	WorkerCommunicationService,
	WorkerCommunicationServiceModel
} from '../simulation/worker-communication/worker-communication-service';
import {TranslateService} from '@ngx-translate/core';
import {HelpWindowService} from '../help-window/help-window.service';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {

	private _currentWorkMode: WorkMode;
	private _currentComponentTypeToBuild: number = undefined;

	private _workModeSubject = new ReplaySubject<WorkMode>(1);

	constructor(
		private projects: ProjectsService,
		private projectSaveManagement: ProjectSaveManagementService,
		private elemProv: ElementProviderService,
		@Inject(WorkerCommunicationService) private workerCommunicationService: WorkerCommunicationServiceModel,
		private translate: TranslateService,
		private helpWindowService: HelpWindowService
	) {
		this.setWorkMode('select');
	}

	public async setWorkMode(mode: WorkMode, componentTypeToBuild?: number) {
		if (this.currentWorkMode === 'simulation') return;
		this._currentWorkMode = mode;
		if (componentTypeToBuild) {
			this._currentComponentTypeToBuild = componentTypeToBuild;
			const elementType = this.elemProv.getElementById(componentTypeToBuild);
			if (this.elemProv.isUserElement(componentTypeToBuild) && elementType.numInputs === 0 && elementType.numOutputs === 0) {
				this.helpWindowService.showHelpWindow('NEEDS_PLUGS')
			}
		} else {
			delete this._currentComponentTypeToBuild;
		}
		this._workModeSubject.next(mode);
	}

	public async enterSimulation() {
		if (!this.projectSaveManagement.isShare) {
			await this.projects.saveAllOrAllComps();
		} else {
			this.projects.saveComponentsShare();
		}
		try {
			await this.workerCommunicationService.init();
			this._currentWorkMode = 'simulation';
			this._workModeSubject.next('simulation');
			delete this._currentComponentTypeToBuild;
			this.helpWindowService.showHelpWindow('ENTER_SIM');
		} catch (e) {}
	}

	public leaveSimulation() {
		this._currentWorkMode = 'select';
		this._workModeSubject.next('select');
		this.workerCommunicationService.stop();
		delete this._currentComponentTypeToBuild;
	}

	public get currentWorkMode(): WorkMode {
		return this._currentWorkMode;
	}

	public get workModeDescription$(): Observable<string> {
		return this.currentWorkMode$.pipe(
			switchMap(workMode => {
				if (workMode === 'buildComponent') {
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

	public get currentWorkMode$(): Observable<WorkMode> {
		return this._workModeSubject.asObservable().pipe(
			distinctUntilChanged()
		);
	}

	public get onSimulationModeChange(): Observable<boolean> {
		return this._workModeSubject.pipe(
			map((mode) => mode === 'simulation'),
			distinctUntilChanged(),
		);
	}

	public get currentComponentToBuild(): number {
		return this._currentComponentTypeToBuild;
	}

	public get isCompToBuildPlug(): boolean {
		return this.elemProv.isPlugElement(this.currentComponentToBuild);
	}
}
