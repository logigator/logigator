import { Injectable } from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {BehaviorSubject, Observable, ReplaySubject} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {

	public static staticInstance: WorkModeService;

	private _currentWorkMode: WorkMode;
	private _currentComponentTypeToBuild: number = undefined;

	private _workModeSubject = new ReplaySubject<WorkMode>(1);

	constructor(private projectSaveManagement: ProjectSaveManagementService) {
		WorkModeService.staticInstance = this;

		if (projectSaveManagement.isShare) {
			this.setWorkMode('simulation');
		} else {
			this.setWorkMode('select');
		}
	}

	public setWorkMode(mode: WorkMode, componentTypeToBuild?: number) {
		if (this.projectSaveManagement.isShare) return;
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

	public get currentComponentToBuild(): number {
		return this._currentComponentTypeToBuild;
	}
}
