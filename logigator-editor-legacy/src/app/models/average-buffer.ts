export class AverageBuffer {
	private _pointer = 0;
	private readonly _buffer: number[];

	constructor(length: number) {
		this._buffer = new Array(length).fill(0);
	}

	public push(val: number) {
		this._buffer[++this._pointer % this._buffer.length] = val;
	}

	public get average() {
		return this._buffer.reduce((x, y) => x + y) / this._buffer.length;
	}

	public get buffer() {
		return this._buffer;
	}
}
