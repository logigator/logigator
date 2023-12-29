import { Injectable, ViewContainerRef } from '@angular/core';
import { WorkMode } from '../../models/work-modes';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ProjectsService } from '../projects/projects.service';
import { ElementProviderService } from '../element-provider/element-provider.service';
import { TranslateService } from '@ngx-translate/core';
import { SimulationManagementService } from '../simulation/simulation-management/simulation-management.service';
import { LoadingService } from '../loading/loading.service';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {
	private _currentWorkMode: WorkMode = WorkMode.SELECT;

	private _currentWorkModeSubject = new BehaviorSubject<WorkMode>(
		WorkMode.SELECT
	);

	private _simulationModeSubject = new Subject<boolean>();

	private _currentComponentTypeToBuild: number = undefined;

	constructor(
		private projects: ProjectsService,
		private elemProv: ElementProviderService,
		private simulationManagement: SimulationManagementService,
		private translate: TranslateService,
		private loadingService: LoadingService
	) {}

	public setWorkMode(workMode: WorkMode, compToBuild?: number) {
		this._currentComponentTypeToBuild = compToBuild;
		this._currentWorkMode = workMode;
		this._currentWorkModeSubject.next(workMode);
	}

	public async enterSimulation(loadingInsertionPoint?: ViewContainerRef) {
		const removeLoading = this.loadingService.add(
			'LOADING.ENTER_SIMULATION',
			loadingInsertionPoint
		);
		await this.projects.saveAllProjects();
		try {
			await this.simulationManagement.enterSimulation();
			delete this._currentComponentTypeToBuild;
			this._currentWorkMode = WorkMode.SIMULATION;
			this._currentWorkModeSubject.next(WorkMode.SIMULATION);
			this._simulationModeSubject.next(true);
		} finally {
			removeLoading();
		}
	}

	public async leaveSimulation(loadingInsertionPoint?: ViewContainerRef) {
		const removeLoading = this.loadingService.add(
			'LOADING.LEAVE_SIMULATION',
			loadingInsertionPoint
		);
		await this.simulationManagement.leaveSimulation();
		delete this._currentComponentTypeToBuild;
		this._currentWorkMode = WorkMode.SELECT;
		this._currentWorkModeSubject.next(WorkMode.SELECT);
		this._simulationModeSubject.next(false);
		removeLoading();
	}

	public get currentWorkMode(): WorkMode {
		return this._currentWorkMode;
	}

	public get currentWorkMode$(): Observable<WorkMode> {
		return this._currentWorkModeSubject.asObservable();
	}

	public get isSimulationMode$(): Observable<boolean> {
		return this._simulationModeSubject.asObservable();
	}

	public get workModeDescription$(): Observable<string> {
		return this._currentWorkModeSubject.pipe(
			switchMap((workMode) => {
				if (workMode === WorkMode.COMPONENT) {
					return this.translate
						.get(
							this.elemProv.getElementById(this._currentComponentTypeToBuild)
								.name
						)
						.pipe(
							switchMap((comp) => {
								return this.translate.get('WORK_MODE_DES.' + workMode, {
									comp
								});
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
}
