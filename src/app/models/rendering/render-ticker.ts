export class RenderTicker {

	public static windowWorkAreaTicker = new RenderTicker();

	private _tickerFn: () => void;

	private _requestId: number;
	private _started = false;

	constructor() {}

	public setTickerFunction(fn: () => void) {
		this._tickerFn = fn;
	}

	public singleFrame() {
		if (!this._requestId) {
			this._requestId = requestAnimationFrame(this.tick.bind(this));
		}
	}

	private tick() {
		this._requestId = null;
		this._tickerFn();

		if (this._started) {
			this.singleFrame();
		}
	}

	public start() {
		this._started = true;
		this.cancelFrameIfNeeded();
		this.singleFrame();
	}

	public stop() {
		this._started = false;
	}

	private cancelFrameIfNeeded() {
		if (this._requestId) {
			cancelAnimationFrame(this._requestId);
			this._requestId = null;
		}
	}
}
