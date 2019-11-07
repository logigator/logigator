import {Injectable, IterableDiffer, IterableDiffers, NgZone} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {PowerChangesOutWire, PowerChangesOutWireEnd} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmMethod, WasmRequest, WasmResponse} from '../../../models/simulation/wasm-interface';
import {Element} from '../../../models/element';
import {InputEvent} from '../../../models/simulation/board';
import {ErrorHandlingService} from '../../error-handling/error-handling.service';
import {CompileError} from '../../../models/simulation/error';
import {ElementProviderService} from '../../element-provider/element-provider.service';

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

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService,
		private ngZone: NgZone,
		private errorHandling: ErrorHandlingService,
		private elementProvider: ElementProviderService
	) {
		this._powerSubjectsWires = new Map<string, Subject<PowerChangesOutWire>>();
		this._powerSubjectsWireEnds = new Map<string, Subject<Map<Element, boolean[]>>>();
		this.initWorker();
	}

	private handleResponse(event: any): void {
		if (!this._initialized) {
			if (event.data.initialized === undefined)
				return;

			if (event.data.initialized === true) {
				this._initialized = true;
			} else {
				console.log(event.data);
				this.errorHandling.showErrorMessage('WebWorker failed to initialize.');
			}
			return;
		}

		const data = event.data as WasmResponse;
		if (data.success) {
			const state = new Uint8Array(data.state);

			if (state.length !== this.stateCompiler.highestLinkId + 1) {
				console.error(data);
				this.errorHandling.showErrorMessage(`Response data length does not match component count`);
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

		try {
			const compiledBoard = await this.stateCompiler.compileAsInt32Array(project);
			if (!compiledBoard) {
				this.errorHandling.showErrorMessage('Failed to compile board.');
				return;
			}

			this.finalizeInit(compiledBoard.buffer);
		} catch (e) {
			if (!this.elementProvider.hasElement(e.comp) || !this.elementProvider.hasElement(e.src)) return;
			e.comp = this.elementProvider.getElementById(e.comp).name;
			e.src = this.elementProvider.getElementById(e.src).name;
			this.errorHandling.showErrorMessage((e as CompileError).name, e);
			throw e;
		}
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

	public setUserInput(identifier: string, element: Element, state: boolean[]): void {
		const index = this.stateCompiler.ioElemIndexes.get(identifier).get(element);
		const inputEvent = InputEvent.Cont;
		const stateBuffer = Int8Array.from(state as any).buffer;

		const request = {
			method: WasmMethod.triggerInput,
			userInput: {
				index,
				inputEvent,
				state: stateBuffer
			}
		} as WasmRequest;
		this._worker.postMessage(request, [ stateBuffer ]);
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
