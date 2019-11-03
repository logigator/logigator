import {Injectable, IterableDiffer, IterableDiffers, NgZone} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {PowerChangesOutWire, PowerChangesOutWireEnd} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmMethod, WasmRequest, WasmResponse} from '../../../models/simulation/wasm-interface';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import {Element} from '../../../models/element';

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

	private _dataCache: Int8Array;

	private _compiledBoard: SimulationUnit[];

	private _userInputChanges: Map<number, boolean> = new Map<number, boolean>();

	private _powerStatesDiffer: IterableDiffer<number>;

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService,
		private ngZone: NgZone,
		private iterableDiffers: IterableDiffers
	) {
		this._powerSubjectsWires = new Map<string, Subject<PowerChangesOutWire>>();
		this._powerSubjectsWireEnds = new Map<string, Subject<PowerChangesOutWireEnd>>();
		this.initWorker();
	}

	private handleResponse(event: any): void {
		if (!this._initialized) {
			if (event.data.initialized === undefined)
				return;

			if (event.data.initialized === true)
				this._initialized = true;
			else
				console.error('WebWorker failed to initialize.', event.data);
			return;
		}

		const data = event.data as WasmResponse;
		if (data.success) {
			if (data.state.length !== this.stateCompiler.highestLinkId + 1) {
				console.error(`Response data length does not match component count`, data, this._compiledBoard);
			}
			this._dataCache = data.state;

			const powerChangesWire = new Map<string, PowerChangesOutWire>();
			const powerChangesWireEnds = new Map<string, PowerChangesOutWireEnd>();
			for (const identifier of this._powerSubjectsWires.keys()) {
				powerChangesWire.set(identifier, this.getWireState(identifier, data.state));
				powerChangesWireEnds.set(identifier, this.getWireEndState(identifier, data.state));
			}
			for (const projId of this._powerSubjectsWires.keys()) {
				this._powerSubjectsWires.get(projId).next(powerChangesWire.get(projId));
				console.log(powerChangesWireEnds);
				this._powerSubjectsWireEnds.get(projId).next(powerChangesWireEnds.get(projId));
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

	public getWireState(identifier: string, data?: Int8Array): Map<Element, boolean> {
		if (!data)
			data = this._dataCache;
		const out = new Map<Element, boolean>();
		for (const [link, wires] of this.stateCompiler.wiresOnLinks.get(identifier).entries()) {
			for (const wire of wires) {
				out.set(wire, data[link] as unknown as boolean);
			}
		}
		return out;
	}

	public getWireEndState(identifier: string, data?: Int8Array): Map<{component: Element, wireIndex: number}, boolean> {
		if (!data)
			data = this._dataCache;
		const out = new Map<{component: Element, wireIndex: number}, boolean>();
		for (const [link, wires] of this.stateCompiler.wireEndsOnLinks.get(identifier).entries()) {
			for (const wire of wires) {
				out.set(wire, data[link] as unknown as boolean);
			}
		}
		return out;
	}

	public async init(): Promise<void> {
		if (!this._initialized)
			return;

		const project = this.projectsService.mainProject;

		this._compiledBoard = await this.stateCompiler.compile(project);
		this._userInputChanges = new Map<number, boolean>();
		this._powerStatesDiffer = this.iterableDiffers.find(new Int8Array()).create();
		if (!this._compiledBoard)
			console.error('Failed to compile board.');

		this.finalizeInit();
	}

	private initWorker() {
		if (this._worker)
			this._worker.terminate();

		this._initialized = false;
		this._worker = new Worker('../../../simulation-worker/simulation.worker', { type: 'module' });
		this.ngZone.runOutsideAngular(() => {
			this._worker.addEventListener('message', (event) => this.handleResponse(event as any));
		});
	}

	private finalizeInit() {
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
		this._worker.postMessage({
			method: WasmMethod.reset
		} as WasmRequest);
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

	public subscribe(identifier: string): void {
		if (!this._powerSubjectsWires.has(identifier)) {
			this._powerSubjectsWires.set(identifier, new Subject<PowerChangesOutWire>());
			this._powerSubjectsWireEnds.set(identifier, new Subject<PowerChangesOutWireEnd>());
		}
	}

	public unsubscribe(identifier: string): void {
		this._powerSubjectsWires.delete(identifier);
		this._powerSubjectsWireEnds.delete(identifier);
	}
}
