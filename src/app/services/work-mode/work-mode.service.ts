import { Injectable } from '@angular/core';
import {WorkMode} from '../../models/work-modes';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {

	private _currentWorkMode: WorkMode = 'select';
	private _currentComponentTypeToBuild: number = undefined;

	constructor() { }

	public setWorkMode(mode: WorkMode, componentTypeToBuild?: number) {
		this._currentWorkMode = mode;
		if (componentTypeToBuild) {
			this._currentComponentTypeToBuild = componentTypeToBuild;
		} else {
			delete this._currentComponentTypeToBuild;
		}
	}

	public get currentWorkMode(): WorkMode {
		return this._currentWorkMode;
	}

	public get currentComponentToBuild(): number {
		return this._currentComponentTypeToBuild;
	}
}
