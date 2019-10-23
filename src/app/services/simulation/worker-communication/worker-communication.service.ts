import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {PowerChangesOut} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmMethod, WasmRequest, WasmResponse} from '../../../models/simulation/wasm-interface';

@Injectable({
	providedIn: 'root'
})
export class WorkerCommunicationService {

	private _powerSubjects: Map<number, Subject<PowerChangesOut>>;
	private readonly _worker: Worker;

	private _frameTime: number;

	private _compiledBoard: any; // TODO

	private _userInputChanges: Map<number, boolean>;

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService
	) {
		this._worker = new Worker('../../../simulation-worker/simulation.worker', { type: 'module' });
		// this._worker.postMessage({kek: '_worker'});
		this._worker.addEventListener('message', (event) => this.handleResponse(event as any));
	}

	private handleResponse(event: any): void {
		const data = event.data as WasmResponse;
		if (data.success) {
			const powerChangesOut = new Map<number, PowerChangesOut>();
			for (const state of data.state) {
				// for (const obj of this.stateCompiler.elementsOnLink.get(link)) {
				// 	if (!powerChangesOut.has(obj.projectId))
				// 		powerChangesOut.set(obj.projectId, new Map<Element, boolean>());
				// 	powerChangesOut.get(obj.projectId).set(obj.element, state);
				// }
			}
			for (const [k, v] of powerChangesOut.entries()) {
				this._powerSubjects.get(k).next(v);
			}
		} else {
			console.error(data.error);
		}
	}

	public init(): boolean {
		const project = this.projectsService.mainProject;
		// this changes in a future version of stateCompiler
		this._compiledBoard = this.stateCompiler.compile(project);
		const components = [...this._compiledBoard.keys()];
		if (!components)
			return false;
		const board = {
			links: 0,
			components
		};
		const request: WasmRequest = {
			method: WasmMethod.init,
			board
		};
		this._worker.postMessage(request);
	}

	public stop(): void {
		const request: WasmRequest = {
			method: WasmMethod.stop
		};
		this._worker.postMessage(request);
	}

	public pause(): void {
		const request: WasmRequest = {
			method: WasmMethod.pause
		};
		this._worker.postMessage(request);
	}

	public continue(): void {
		const request: WasmRequest = {
			method: WasmMethod.cont,
			time: this._frameTime,
			userInputs: this._userInputChanges
		};
		this._worker.postMessage(request);
		this._userInputChanges.clear();
	}

	public singleStep(): void {
		const request: WasmRequest = {
			method: WasmMethod.single,
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

	public boardState(projectId: number): Observable<PowerChangesOut> {
		return this._powerSubjects.get(projectId).asObservable();
	}
}
