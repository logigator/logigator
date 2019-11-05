import {Injectable, IterableDiffer, IterableDiffers, NgZone} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {PowerChangesOutWire, PowerChangesOutWireEnd} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmMethod, WasmRequest, WasmResponse} from '../../../models/simulation/wasm-interface';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import {Element} from '../../../models/element';
import {InputEvent} from '../../../models/simulation/board';

@Injectable({
	providedIn: 'root'
})
export class WorkerCommunicationService {

	private _powerSubjectsWires: Map<string, Subject<PowerChangesOutWire>>;
	private _powerSubjectsWireEnds: Map<string, Subject<Map<Element, boolean[]>>>;
	private _worker: Worker;

	private _frameTime = 1;
	private _initialized = false;
	private _isContinuous = false;

	private _dataCache: Uint8Array;

	private _powerStatesDiffer: IterableDiffer<number>;

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService,
		private ngZone: NgZone,
		private iterableDiffers: IterableDiffers
	) {
		this._powerSubjectsWires = new Map<string, Subject<PowerChangesOutWire>>();
		this._powerSubjectsWireEnds = new Map<string, Subject<Map<Element, boolean[]>>>();
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
			const state = new Uint8Array(data.state);

			if (state.length !== this.stateCompiler.highestLinkId + 1) {
				console.error(`Response data length does not match component count`, data);
			}
			this._dataCache = state;

			if (data.method !== WasmMethod.init) {
				const powerChangesWire = new Map<string, PowerChangesOutWire>();
				const powerChangesWireEnds = new Map<string, Map<Element, boolean[]>>();
				for (const identifier of this._powerSubjectsWires.keys()) {
					powerChangesWire.set(identifier, this.getWireState(identifier, state));
					powerChangesWireEnds.set(identifier, this.getWireEndState(identifier, state));
				}
				for (const projId of this._powerSubjectsWires.keys()) {
					this._powerSubjectsWires.get(projId).next(powerChangesWire.get(projId));
					this._powerSubjectsWireEnds.get(projId).next(powerChangesWireEnds.get(projId));
				}
			}

			if (this._isContinuous) {
				const request: WasmRequest = {
					method: WasmMethod.cont,
					time: this._frameTime
				};
				this._worker.postMessage(request);
			}
		} else {
			console.error('error', data);
		}
	}

	public getWireState(identifier: string, data?: Uint8Array): Map<Element, boolean> {
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

	public getWireEndState(identifier: string, data?: Uint8Array): Map<Element, boolean[]> {
		if (!data)
			data = this._dataCache;
		const out = new Map<Element, boolean[]>();
		for (const [link, wireEndOnComps] of this.stateCompiler.wireEndsOnLinks.get(identifier).entries()) {
			for (const wireEndOnComp of wireEndOnComps) {
				const elem = wireEndOnComp.component;
				if (!out.has(elem))
					out.set(elem, new Array(elem.numInputs + elem.numOutputs));
				out.get(elem)[wireEndOnComp.wireIndex] = data[link] as unknown as boolean;

			}
		}
		return out;
	}

	public async init(): Promise<void> {
		if (!this._initialized)
			return;

		const project = this.projectsService.mainProject;

		const compiledBoard = await this.stateCompiler.compileAsInt32Array(project);
		this._powerStatesDiffer = this.iterableDiffers.find(new Int8Array()).create();
		if (!compiledBoard) {
			console.error('Failed to compile board.');
			return;
		}

		this.finalizeInit(compiledBoard.buffer);
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

	private finalizeInit(compiledBoard: ArrayBuffer) {
		this._worker.postMessage({
			method: WasmMethod.init,
			board: {
				links: this.stateCompiler.highestLinkId + 1,
				components: compiledBoard
			}
		} as WasmRequest, [ compiledBoard ]);
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
			time: this._frameTime
		};
		this._isContinuous = true;
		this._worker.postMessage(request);
		this._worker.postMessage(request);
	}

	public singleStep(): void {
		const request: WasmRequest = {
			method: WasmMethod.single
		};
		this._worker.postMessage(request);
	}

	public setFrameTime(frameTime: number): void {
		this._frameTime = frameTime;
	}

	public setUserInput(identifier: string, element: Element, state: boolean): void {
		const links = this.stateCompiler.linksOnIOElems.get(identifier).get(element);

		const index = 0;
		const inputEvent = InputEvent.Pulse;
		const stateBuffer = new ArrayBuffer(0);

		this._worker.postMessage({
			method: WasmMethod.triggerInput,
			userInput: {
				index,
				inputEvent,
				state: stateBuffer
			}
		} as WasmRequest, [ stateBuffer ]);
	}

	public boardStateWires(projectId: string): Observable<PowerChangesOutWire> {
		return this._powerSubjectsWires.get(projectId).asObservable();
	}

	public boardStateWireEnds(projectId: string): Observable<Map<Element, boolean[]>> {
		return this._powerSubjectsWireEnds.get(projectId).asObservable();
	}

	public subscribe(identifier: string): void {
		if (!this._powerSubjectsWires.has(identifier)) {
			this._powerSubjectsWires.set(identifier, new Subject<PowerChangesOutWire>());
			this._powerSubjectsWireEnds.set(identifier, new Subject<Map<Element, boolean[]>>());
		}
	}

	public unsubscribe(identifier: string): void {
		this._powerSubjectsWires.delete(identifier);
		this._powerSubjectsWireEnds.delete(identifier);
	}
}
