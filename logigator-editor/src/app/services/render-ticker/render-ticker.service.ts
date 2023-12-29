import { Inject, Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import {
	WorkerCommunicationService,
	WorkerCommunicationServiceModel
} from '../simulation/worker-communication/worker-communication-service-model';

interface TickerFunction {
	fn: () => void;
	requestedFrame: boolean;
	started: boolean;
	singleFramePromiseResolveFns: (() => void)[];
}

@Injectable({
	providedIn: 'root'
})
export class RenderTicker {
	constructor(
		@Inject(WorkerCommunicationService)
		private workerCommunicationService: WorkerCommunicationServiceModel
	) {}

	private _tickerFunctions = new Map<string, TickerFunction>();

	private _startedAllCont = false;

	public addTickerFunction(identifier: string, fn: () => void) {
		this._tickerFunctions.set(identifier, {
			fn: this.getTickerFunction(fn, identifier),
			requestedFrame: false,
			started: false,
			singleFramePromiseResolveFns: []
		});
		if (this._startedAllCont) {
			this.startTicker(identifier);
		}
	}

	public removeTickerFunction(identifier: string) {
		if (!this._tickerFunctions.has(identifier)) return;
		this.stopTicker(identifier, false, true);
		this._tickerFunctions.delete(identifier);
	}

	/**
	 * @returns Promise resolved after the frame was rendered
	 */
	public singleFrame(identifier: string): Promise<void> {
		const tf = this._tickerFunctions.get(identifier);
		return new Promise<void>((resolve) => {
			if (!tf) {
				resolve();
				return;
			}
			if (!tf.started && !tf.requestedFrame) {
				tf.requestedFrame = true;
				PIXI.Ticker.shared.addOnce(tf.fn, this);
			}
			tf.singleFramePromiseResolveFns.push(resolve);
		});
	}

	public startTicker(identifier: string) {
		const tf = this._tickerFunctions.get(identifier);
		if (tf && !tf.started) {
			tf.started = true;
			PIXI.Ticker.shared.add(tf.fn, this);
		}
	}

	public startAllContSim() {
		this._startedAllCont = true;
		for (const id of this._tickerFunctions.keys()) {
			this.startTicker(id);
		}
	}

	public stopAllContSim() {
		this._startedAllCont = false;
		for (const id of this._tickerFunctions.keys()) {
			this.stopTicker(id, true, true);
		}
	}

	public stopTicker(
		identifier: string,
		keepRequestFrame = true,
		force = false
	) {
		if (!this._tickerFunctions.has(identifier)) return;
		if (this._startedAllCont && !force) return;
		const tf = this._tickerFunctions.get(identifier);
		tf.started = false;
		tf.singleFramePromiseResolveFns = [];
		PIXI.Ticker.shared.remove(tf.fn, this);
		if (tf.requestedFrame && keepRequestFrame)
			PIXI.Ticker.shared.addOnce(tf.fn, this);
	}

	public get FPS(): number {
		return PIXI.Ticker.shared.FPS;
	}

	public get frameTime(): number {
		return PIXI.Ticker.shared.elapsedMS;
	}

	private getTickerFunction(
		originalFn: () => void,
		identifier: string
	): () => void {
		return () => {
			originalFn();
			const tf = this._tickerFunctions.get(identifier);
			tf.requestedFrame = false;
			for (const resolve of tf.singleFramePromiseResolveFns) {
				resolve();
			}
			tf.singleFramePromiseResolveFns = [];
			if (identifier === '0')
				this.workerCommunicationService.setFrameTime(this.frameTime);
		};
	}
}
