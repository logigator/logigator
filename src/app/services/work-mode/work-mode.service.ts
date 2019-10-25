import { Injectable } from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {Observable, ReplaySubject} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';
import {ProjectsService} from '../projects/projects.service';
import {ElementProviderService} from '../element-provider/element-provider.service';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {checkActionUsable} from '../../models/action-usable-in-modes';
import {StateCompilerService} from '../simulation/state-compiler/state-compiler.service';

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
		private stateCompiler: StateCompilerService
	) {
		this.setWorkMode('select');
	}

	public async setWorkMode(mode: WorkMode, componentTypeToBuild?: number) {
		if (this.currentWorkMode === 'simulation') return;
		this._currentWorkMode = mode;
		this._workModeSubject.next(mode);
		if (componentTypeToBuild) {
			this._currentComponentTypeToBuild = componentTypeToBuild;
		} else {
			delete this._currentComponentTypeToBuild;
		}
	}

	public async enterSimulation() {
		if (!this.projectSaveManagement.isShare) {
			await this.projects.saveAllOrAllComps();
		} else {
			this.projects.saveComponentsShare();
		}
		console.log(await this.stateCompiler.compile(this.projects.mainProject));
		this._currentWorkMode = 'simulation';
		this._workModeSubject.next('simulation');
		delete this._currentComponentTypeToBuild;
	}

	public leaveSimulation() {
		this._currentWorkMode = 'select';
		this._workModeSubject.next('select');
		delete this._currentComponentTypeToBuild;
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
