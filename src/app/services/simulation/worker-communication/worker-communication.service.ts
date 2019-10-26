import {Injectable, NgZone} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {PowerChangesOutWire, PowerChangesOutWireEnd} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmMethod, WasmRequest, WasmResponse} from '../../../models/simulation/wasm-interface';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import { Element } from '../../../models/element';

@Injectable({
	providedIn: 'root'
})
export class WorkerCommunicationService {

	private _powerSubjectsWires: Map<string, Subject<PowerChangesOutWire>>;
	private _powerSubjectsWireEnds: Map<string, Subject<PowerChangesOutWireEnd>>;
	private _worker: Worker;

	private _frameTime = 1;
	private _initialized = false;
	private _isContinuous = false;

	private _compiledBoard: SimulationUnit[];

	private _userInputChanges: Map<number, boolean>;

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService,
		private ngZone: NgZone
	) {
		this._powerSubjectsWires = new Map<string, Subject<PowerChangesOutWire>>();
		this._powerSubjectsWireEnds = new Map<string, Subject<PowerChangesOutWireEnd>>();
	}

	private handleResponse(event: any): void {
		if (!this._initialized) {
			if (event.data.initialized === undefined)
				return;

			if (event.data.initialized === true) {
				this._initialized = true;
				this.initBoard();
			} else {
				console.error('WebWorker failed to initialize.', event.data);
			}
			return;
		}

		const data = event.data as WasmResponse;
		if (data.success) {
			if (data.state.length !== this.stateCompiler.highestLinkId + 1) {
				console.error(`Response data length does not match component count`, data, this._compiledBoard);
			}
			// TODO save projects containing specific link
			for (let link = 0; link < data.state.length; link++) {
				const singleState: boolean = !!data.state[link];
				for (const projId of this._powerSubjectsWires.keys()) {
					const powerChangesWire: PowerChangesOutWire = new Map<Element, boolean>();
					const powerChangesWireEnd: PowerChangesOutWireEnd = new Map<{component: Element, wireIndex: number}, boolean>();
					if (this.stateCompiler.wiresOnLinks.get(projId).get(link)) {
						for (const wire of this.stateCompiler.wiresOnLinks.get(projId).get(link)) {
							powerChangesWire.set(wire, singleState);
						}
					}
					if (this.stateCompiler.wireEndsOnLinks.get(projId).get(link)) {
						for (const wireEnd of this.stateCompiler.wireEndsOnLinks.get(projId).get(link)) {
							powerChangesWireEnd.set(wireEnd, singleState);
						}
					}
					this._powerSubjectsWires.get(projId).next(powerChangesWire);
					this._powerSubjectsWireEnds.get(projId).next(powerChangesWireEnd);
				}
			}

			if (this._isContinuous) {
				const request: WasmRequest = {
					method: WasmMethod.cont,
					time: this._frameTime,
					userInputs: this._userInputChanges
				};
				this._worker.postMessage(request);
				this._userInputChanges.clear();
			}
		} else {
			console.error('error', data);
		}
	}

	public async init(): Promise<void> {
		if (this._worker)
			this._worker.terminate();
		this._initialized = false;
		this._worker = new Worker('../../../simulation-worker/simulation.worker', { type: 'module' });
		this.ngZone.runOutsideAngular(() => {
			this._worker.addEventListener('message', (event) => this.handleResponse(event as any));
		});
	}

	private async initBoard() {
		const project = this.projectsService.mainProject;
		this._compiledBoard = await this.stateCompiler.compile(project);
		this._userInputChanges = new Map<number, boolean>();
		if (!this._compiledBoard)
			return false;
		const board = {
			links: this.stateCompiler.highestLinkId + 1,
			components: this._compiledBoard
		};
		const request: WasmRequest = {
			method: WasmMethod.init,
			board
		};
		this._worker.postMessage(request);
	}

	public stop(): void {
		this._isContinuous = false;
	}

	public pause(): void {
		this._isContinuous = false;
	}

	public start(): void {
		const request: WasmRequest = {
			method: WasmMethod.cont,
			time: this._frameTime,
			userInputs: this._userInputChanges
		};
		this._isContinuous = true;
		this._worker.postMessage(request);
		this._userInputChanges.clear();
		this._worker.postMessage(request);
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

	public boardStateWires(projectId: string): Observable<PowerChangesOutWire> {
		return this._powerSubjectsWires.get(projectId).asObservable();
	}

	public boardStateWireEnds(projectId: string): Observable<PowerChangesOutWireEnd> {
		return this._powerSubjectsWireEnds.get(projectId).asObservable();
	}

	public subscribe(projectId: string): void {
		if (!this._powerSubjectsWires.has(projectId)) {
			this._powerSubjectsWires.set(projectId, new Subject<PowerChangesOutWire>());
			this._powerSubjectsWireEnds.set(projectId, new Subject<PowerChangesOutWireEnd>());
		}
	}

	public unsubscribe(projectId: string): void {
		this._powerSubjectsWires.delete(projectId);
		this._powerSubjectsWireEnds.delete(projectId);
	}
}
