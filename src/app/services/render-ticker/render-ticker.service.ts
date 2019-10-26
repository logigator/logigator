import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';

interface TickerFunction {
	fn: () => void;
	requestedFrame: boolean;
	started: boolean;
}

@Injectable({
	providedIn: 'root'
})
export class RenderTicker {

	private _tickerFunctions = new Map<string, TickerFunction>();

	public addTickerFunction(identifier: string, fn: () => void) {
		this._tickerFunctions.set(identifier, {
			fn: this.getTickerFunction(fn, identifier),
			requestedFrame: false,
			started: false
		});
	}

	public removeTickerFunction(identifier: string) {
		this.stopTicker(identifier);
		this._tickerFunctions.delete(identifier);
	}

	public singleFrame(identifier: string) {
		const tf = this._tickerFunctions.get(identifier);
		if (!tf.started && !tf.requestedFrame) {
			tf.requestedFrame = true;
			PIXI.Ticker.shared.addOnce(tf.fn, this);
		}
	}

	public startTicker(identifier: string) {
		const tf = this._tickerFunctions.get(identifier);
		if (!tf.started) {
			tf.started = true;
			PIXI.Ticker.shared.add(tf.fn, this);
		}
	}

	public stopTicker(identifier: string) {
		const tf = this._tickerFunctions.get(identifier);
		tf.started = false;
		PIXI.Ticker.shared.remove(tf.fn, this);
		if (tf.requestedFrame) PIXI.Ticker.shared.addOnce(tf.fn, this);
	}

	public get FPS(): number {
		return PIXI.Ticker.shared.FPS;
	}

	public get frameTime(): number {
		return PIXI.Ticker.shared.elapsedMS;
	}

	private getTickerFunction(originalFn: () => void, identifier: string): () => void {
		return () => {
			this._tickerFunctions.get(identifier).requestedFrame = false;
			originalFn();
		};
	}
}
