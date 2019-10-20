import { Injectable } from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {BehaviorSubject, Observable, ReplaySubject} from 'rxjs';
import {distinctUntilChanged, map, switchMap, takeUntil} from 'rxjs/operators';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {ProjectsService} from '../projects/projects.service';
import {ElementProviderService} from '../element-provider/element-provider.service';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {

	public static staticInstance: WorkModeService;

	private _currentWorkMode: WorkMode;
	private _currentComponentTypeToBuild: number = undefined;

	private _workModeSubject = new ReplaySubject<WorkMode>(1);

	constructor(
		private projectSaveManagement: ProjectSaveManagementService,
		private project: ProjectsService,
		private elemProv: ElementProviderService
	) {
		WorkModeService.staticInstance = this;

		if (projectSaveManagement.isShare) {
			this.setWorkMode('simulation');
		} else {
			this.setWorkMode('select');
		}
	}

	public async setWorkMode(mode: WorkMode, componentTypeToBuild?: number) {
		if (this.projectSaveManagement.isShare) return;

		if (mode === 'simulation') {
			await this.project.saveAllComponents();
		}
		this._currentWorkMode = mode;
		this._workModeSubject.next(mode);
		if (componentTypeToBuild) {
			this._currentComponentTypeToBuild = componentTypeToBuild;
		} else {
			delete this._currentComponentTypeToBuild;
		}
	}

	public get currentWorkMode(): WorkMode {
		return this._currentWorkMode;
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
