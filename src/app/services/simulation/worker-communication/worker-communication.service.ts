import { Injectable } from '@angular/core';
import {Observable} from 'rxjs';
import {PowerChanges} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmRequest} from '../../../models/simulation/wasm-interface';
import {SimulationUnits} from '../../../models/simulation/simulation-unit';

@Injectable({
	providedIn: 'root'
})
export class WorkerCommunicationService {

	private _powerSubjects: Map<number, Observable<PowerChanges>>;
	private readonly _worker: Worker;

	private _frameTime: number;

	private _compiledBoard: any; // TODO

	private _userInputChanges: Map<number, boolean>;

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService
	) {
		this._worker = new Worker('../../../simulation-_worker/simulation._worker', { type: 'module' });
		// this._worker.postMessage({kek: '_worker'});
		// this._worker.addEventListener('message', console.log);
	}

	public init(): boolean {
		const project = this.projectsService.mainProject;
		// this changes in a future version of stateCompiler
		this._compiledBoard = this.stateCompiler.compile(project.currState);
		const components = [...this._compiledBoard.keys()];
		if (!components)
			return false;
		const board = {
			links: 0,
			components
		};
		const request: WasmRequest = {
			method: 'init',
			board
		};
		this._worker.postMessage(request);
	}

	public stop(): void {
		const request: WasmRequest = {
			method: 'stop'
		};
		this._worker.postMessage(request);
	}

	public pause(): void {
		const request: WasmRequest = {
			method: 'pause'
		};
		this._worker.postMessage(request);
	}

	public continue(): void {
		const request: WasmRequest = {
			method: 'cont',
			time: this._frameTime,
			userInputs: this._userInputChanges
		};
		this._worker.postMessage(request);
		this._userInputChanges.clear();
	}

	public singleStep(): void {
		const request: WasmRequest = {
			method: 'single',
			userInputs: this._userInputChanges
		};
		this._worker.postMessage(request);
		this._userInputChanges.clear();
	}



	public setFrameTime(frameTime: number): void {
		this._frameTime = frameTime;
	}

	public setUserInput(element: Element, state: boolean): void {
		// const unit = this._compiledBoard.get(element);
		// for (const link of SimulationUnits.concat(unit)) {
		for (const link of [0, 1, 2]) {
			this._userInputChanges.set(link, state);
		}
	}

	public boardState(projectId: number): Observable<PowerChanges> {
		return this._powerSubjects.get(projectId);
	}
}
