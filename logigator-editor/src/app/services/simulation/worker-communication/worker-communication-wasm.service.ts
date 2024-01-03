// @ts-strict-ignore
import { Injectable, NgZone } from '@angular/core';
import { timer } from 'rxjs';
import {
	WasmMethod,
	WasmRequest,
	WasmResponse
} from '../../../models/simulation/wasm-interface';
import { Element } from '../../../models/element';
import {
	BoardState,
	BoardStatus,
	InputEvent
} from '../../../models/simulation/board';
import { takeWhile } from 'rxjs/operators';
import { ErrorHandlingService } from '../../error-handling/error-handling.service';
import { CompileError } from '../../../models/simulation/compile-error';
import { AverageBuffer } from '../../../models/average-buffer';
import { ElementTypeId } from '../../../models/element-types/element-type-ids';
import { EastereggService } from '../../easteregg/easteregg.service';
import { WorkerCommunicationServiceModel } from './worker-communication-service-model';
import { InvalidPlugsError } from '../../../models/simulation/invalid-plugs-error';

@Injectable()
export class WorkerCommunicationWasmService
	implements WorkerCommunicationServiceModel
{
	private _worker: Worker;

	private _initialized = false;
	private _mode: 'continuous' | 'target' | 'sync';
	private _frameAverage = new AverageBuffer(5);

	private _targetSpeed = 0;
	private _targetLastRun = Date.now();
	private _targetUnprocessedFraction = 0;

	private _status: BoardStatus = {
		tick: 0,
		componentCount: 0,
		linkCount: 0,
		speed: 0,
		state: BoardState.Uninitialized
	};

	constructor(
		private ngZone: NgZone,
		private errorHandling: ErrorHandlingService,
		private eastereggs: EastereggService
	) {
		this.initWorker();
	}

	private handleResponse(event: MessageEvent): void {
		if (!this._initialized) {
			if (event.data.initialized === undefined) return;

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
			// const state = new Uint8Array(data.state);

			if (data.method === WasmMethod.run || data.method === WasmMethod.reset) {
				// TODO
			}

			if (data.method === WasmMethod.run && this._mode === 'continuous') {
				const request: WasmRequest = {
					method: WasmMethod.run,
					time: this._frameAverage.average
				};
				this._worker.postMessage(request);
			} else if (data.method === WasmMethod.run && this._mode === 'target') {
				const timestamp = Date.now();
				const ticks =
					((timestamp - this._targetLastRun) * this._targetSpeed) / 1000 +
					this._targetUnprocessedFraction;
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
				this.ngZone.run(() => (this._status = data.status));
			}
		} else {
			console.error('error', data);
		}
	}

	public async init(): Promise<void> {
		if (!this._initialized) return;

		// const project = this.projectsService.mainProject;

		try {
			const compiledBoard = null;
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
					plugIndex: e.plugIndex
				});
			}
			if (e instanceof CompileError) {
				if (e.comp !== undefined && e.src !== undefined) {
					this.errorHandling.showErrorMessage(e.message, {});
				} else {
					this.errorHandling.showErrorMessage(e.message);
				}
			}
			throw e;
		}
	}

	private initWorker() {
		if (this._worker) this._worker.terminate();

		this._initialized = false;
		this._worker = new Worker(
			new URL(
				'../../../worker/simulation-worker/simulation.worker',
				import.meta.url
			),
			{ type: 'classic' }
		);
		this.ngZone.runOutsideAngular(() => {
			this._worker.addEventListener('message', (event) =>
				this.handleResponse(event)
			);
		});
	}

	private finalizeInit(compiledBoard: ArrayBuffer) {
		this._worker.postMessage(
			{
				method: WasmMethod.init,
				board: {
					links: 0, // TODO
					components: compiledBoard
				}
			} as WasmRequest,
			[compiledBoard]
		);
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
		if (this._mode === 'continuous') return;

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
		if (this._mode === 'target') return;

		if (target && target >= 0) this._targetSpeed = target;

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
		if (this._mode === 'sync') return;

		this._mode = 'sync';
		this.registerStatusWatch();
		this.singleStep();
	}

	public setTarget(target: number) {
		if (target >= 0) this._targetSpeed = target;
	}

	private registerStatusWatch() {
		const mode = this._mode;

		this.ngZone.runOutsideAngular(() => {
			timer(0, 1000)
				.pipe(takeWhile(() => mode === this._mode))
				.subscribe(() => {
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
		this._frameAverage.push(
			frameTime > this._frameAverage.average + 100
				? this._frameAverage.average + 100
				: frameTime
		);

		if (this._mode === 'sync') {
			const request: WasmRequest = {
				method: WasmMethod.run,
				ticks: 1
			};
			this._worker.postMessage(request);
		}
	}

	public setUserInput(
		identifier: string,
		element: Element,
		state: boolean[]
	): void {
		let inputEvent: InputEvent;
		if (element.typeId === ElementTypeId.BUTTON) {
			inputEvent = InputEvent.Pulse;
		} else if (element.typeId === ElementTypeId.LEVER) {
			inputEvent = InputEvent.Cont;
		}
		const stateBuffer = Int8Array.from(state as unknown as number[]).buffer;

		const request = {
			method: WasmMethod.triggerInput,
			userInput: {
				index: 0, // TODO
				inputEvent,
				state: stateBuffer
			}
		} as WasmRequest;
		this._worker.postMessage(request, [stateBuffer]);
	}

	public get status(): BoardStatus {
		return this._status;
	}

	public get isRunning() {
		return !!this._mode;
	}
}
