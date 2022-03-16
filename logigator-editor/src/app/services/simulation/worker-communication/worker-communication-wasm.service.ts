import {Injectable, NgZone} from '@angular/core';
import {Observable, Subject, timer} from 'rxjs';
import {PowerChangesOutWire} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmMethod, WasmRequest, WasmResponse} from '../../../models/simulation/wasm-interface';
import {Element} from '../../../models/element';
import {BoardState, BoardStatus, InputEvent} from '../../../models/simulation/board';
import {takeWhile} from 'rxjs/operators';
import {ErrorHandlingService} from '../../error-handling/error-handling.service';
import {CompileError} from '../../../models/simulation/compile-error';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {AverageBuffer} from '../../../models/average-buffer';
import {ElementTypeId} from '../../../models/element-types/element-type-ids';
import {EastereggService} from '../../easteregg/easteregg.service';
import {WorkerCommunicationServiceModel} from './worker-communication-service-model';
import {InvalidPlugsError} from '../../../models/simulation/invalid-plugs-error';

@Injectable()
export class WorkerCommunicationWasmService implements WorkerCommunicationServiceModel {

	private _powerSubjectsWires: Map<string, Subject<PowerChangesOutWire>>;
	private _powerSubjectsWireEnds: Map<string, Subject<Map<Element, boolean[]>>>;
	private _ioComponentsResetSubject: Map<string, Subject<void>>;
	private _worker: Worker;

	private _initialized = false;
	private _mode: 'continuous' | 'target' | 'sync';
	private _frameAverage = new AverageBuffer(5);

	private _targetSpeed = 0;
	private _targetLastRun = Date.now();
	private _targetUnprocessedFraction = 0;

	private _dataCache: Uint8Array;

	private _status: BoardStatus = {
		tick: 0,
		componentCount: 0,
		linkCount: 0,
		speed: 0,
		state: BoardState.Uninitialized
	};

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService,
		private ngZone: NgZone,
		private errorHandling: ErrorHandlingService,
		private elementProvider: ElementProviderService,
		private eastereggs: EastereggService
	) {
		this._powerSubjectsWires = new Map<string, Subject<PowerChangesOutWire>>();
		this._powerSubjectsWireEnds = new Map<string, Subject<Map<Element, boolean[]>>>();
		this._ioComponentsResetSubject = new Map<string, Subject<void>>();
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
				this.errorHandling.showErrorMessage('ERROR.COMPILE.WORKER_INIT');
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

			if (data.method === WasmMethod.run || data.method === WasmMethod.reset) {
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

			if (data.method === WasmMethod.reset) {
				for (const resetSubject of this._ioComponentsResetSubject.values()) {
					resetSubject.next();
				}
			}

			if (data.method === WasmMethod.run && this._mode === 'continuous') {
				const request: WasmRequest = {
					method: WasmMethod.run,
					time: this._frameAverage.average
				};
				this._worker.postMessage(request);
			} else if (data.method === WasmMethod.run && this._mode === 'target') {
				const timestamp = Date.now();
				const ticks = ((timestamp - this._targetLastRun) * this._targetSpeed / 1000) + this._targetUnprocessedFraction;
				const ticksToCompute = Math.trunc(ticks);
				const request: WasmRequest = {
					method: WasmMethod.run,
					time: this._frameAverage.average,
					ticks: ticksToCompute
				};

				if (ticksToCompute) {
					this._targetUnprocessedFraction = ticks % 1;
					this._worker.postMessage(request);
					this._targetLastRun = timestamp;
				} else {
					setTimeout(() => {
						this._worker.postMessage(request);
					}, this._frameAverage.average / 2);
				}
			}

			if (data.method === WasmMethod.status) {
				this.ngZone.run(() => this._status = data.status);
			}
		} else {
			console.error('error', data);
		}
	}

	public getWireState(identifier: string, data?: Uint8Array): Map<Element, boolean> {
		if (!data)
			data = this._dataCache;
		const out = new Map<Element, boolean>();
		if (!this.stateCompiler.wiresOnLinks.has(identifier))
			return out;
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
		if (!this.stateCompiler.wireEndsOnLinks.has(identifier))
			return out;
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
				throw new CompileError('ERROR.COMPILE.FAILED');
			}
			if (compiledBoard.length > 100_000) {
				this.eastereggs.achieve('GBOGH');
			}

			this.finalizeInit(compiledBoard.buffer);
		} catch (e) {
			console.error(e);
			if (e instanceof InvalidPlugsError) {
				this.errorHandling.showErrorMessage(e.message, {
					comp: this.elementProvider.getElementById(e.comp).name,
					plugIndex: e.plugIndex
				});
			}
			if (e instanceof CompileError) {
				if (e.comp !== undefined && e.src !== undefined) {
					this.errorHandling.showErrorMessage(e.message, {
						comp: this.elementProvider.getElementById(e.comp).name,
						src: this.elementProvider.getElementById(e.src).name
					});
				} else {
					this.errorHandling.showErrorMessage(e.message);
				}
			}
			throw e;
		}
	}

	private initWorker() {
		if (this._worker)
			this._worker.terminate();

		this._initialized = false;
		this._worker = new Worker('../../../worker/simulation-worker/simulation.worker', { type: 'module' });
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
		this._mode = undefined;
		this._worker.postMessage({
			method: WasmMethod.reset
		} as WasmRequest);
	}

	public pause(): void {
		this._mode = undefined;
	}

	public start(): void {
		if (this._mode === 'continuous')
			return;

		const request: WasmRequest = {
			method: WasmMethod.run,
			time: this._frameAverage.average
		};
		this._mode = 'continuous';
		this._worker.postMessage(request);
		this._worker.postMessage(request);
		this.registerStatusWatch();
	}

	public startTarget(target?: number): void {
		if (this._mode === 'target')
			return;

		if (target && target >= 0)
			this._targetSpeed = target;

		const request: WasmRequest = {
			method: WasmMethod.run,
			time: this._frameAverage.average,
			ticks: 1
		};
		this._mode = 'target';
		this._worker.postMessage(request);
		this._targetLastRun = Date.now();
		this.registerStatusWatch();
	}

	public startSync(): void {
		if (this._mode === 'sync')
			return;

		this._mode = 'sync';
		this.registerStatusWatch();
		this.singleStep();
	}

	public setTarget(target: number) {
		if (target >= 0)
			this._targetSpeed = target;
	}

	private registerStatusWatch() {
		const mode = this._mode;

		this.ngZone.runOutsideAngular(() => {
			timer(0, 1000).pipe(
				takeWhile(() => mode === this._mode),
			).subscribe(x => {
				this._worker.postMessage({
					method: WasmMethod.status
				} as WasmRequest);
			});
		});
	}

	public singleStep(): void {
		const request: WasmRequest = {
			method: WasmMethod.run,
			ticks: 1
		};
		this._worker.postMessage(request);
		this._worker.postMessage({
			method: WasmMethod.status
		} as WasmRequest);
	}

	public setFrameTime(frameTime: number): void {
		this._frameAverage.push(frameTime > this._frameAverage.average + 100 ? this._frameAverage.average + 100 : frameTime);

		if (this._mode === 'sync') {
			const request: WasmRequest = {
				method: WasmMethod.run,
				ticks: 1
			};
			this._worker.postMessage(request);
		}
	}

	public setUserInput(identifier: string, element: Element, state: boolean[]): void {
		const index = this.stateCompiler.ioElemIndexes.get(identifier).get(element.id);
		let inputEvent: InputEvent;
		if (element.typeId === ElementTypeId.BUTTON) {
			inputEvent = InputEvent.Pulse;
		} else if (element.typeId === ElementTypeId.LEVER) {
			inputEvent = InputEvent.Cont;
		}
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

	public onIoCompReset(projectId: string): Observable<void> {
		return this._ioComponentsResetSubject.get(projectId).asObservable();
	}

	public get status(): BoardStatus {
		return this._status;
	}

	public get isRunning() {
		return !!this._mode;
	}

	public subscribe(identifier: string): void {
		if (!this._powerSubjectsWires.has(identifier)) {
			this._powerSubjectsWires.set(identifier, new Subject<PowerChangesOutWire>());
			this._powerSubjectsWireEnds.set(identifier, new Subject<Map<Element, boolean[]>>());
			this._ioComponentsResetSubject.set(identifier, new Subject<void>());
		}
	}

	public unsubscribe(identifier: string): void {
		this._powerSubjectsWires.delete(identifier);
		this._powerSubjectsWireEnds.delete(identifier);
		this._ioComponentsResetSubject.delete(identifier);
	}
}
