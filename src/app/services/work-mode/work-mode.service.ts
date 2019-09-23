import { Injectable } from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {BehaviorSubject, Observable} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {

	public static staticInstance: WorkModeService;

	private _currentWorkMode: WorkMode = 'select';
	private _currentComponentTypeToBuild: number = undefined;

	private _workModeSubject = new BehaviorSubject<WorkMode>('select');

	constructor() {
		WorkModeService.staticInstance = this;
	}

	public setWorkMode(mode: WorkMode, componentTypeToBuild?: number) {
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
