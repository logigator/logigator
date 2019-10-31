import {Board, BoardStatus} from './board';
import {SimulationModule, TypedArray} from './simulation-module';
import {Pointer} from './wasm-interface';

export class SimulationWorker {

	private _board: Board;
	private _simulationModule: SimulationModule;
	private _linkPointer: number = undefined;

	constructor(board: Board, simulationModule: SimulationModule) {
		this._board = board;
		this._simulationModule = simulationModule;

		simulationModule.initLinks(board.links);
		simulationModule.initComponents(board.components.length);

		board.components.forEach((x, i) => {
			const inputs = new Int32Array(x.inputs);
			const outputs = new Int32Array(x.outputs);

			const inputPtr = this._arrayToHeap(inputs);
			const outputPtr = this._arrayToHeap(outputs);

			simulationModule.initComponent(i, x.typeId, inputPtr, outputPtr, x.inputs.length, x.outputs.length, x.op1 || 0, x.op2 || 0);

			this._simulationModule._free(inputPtr);
			this._simulationModule._free(outputPtr);
		});
		simulationModule.initBoard();
	}

	public start(ms?: number) {
		if (ms)
			this._simulationModule.startTimeout(ms);
		else
			this._simulationModule.start();
	}

	public startManual(ticks: number) {
		this._simulationModule.startManual(ticks);
	}

	public getLinks(): Int8Array {
		if (this._linkPointer === undefined)
			this._linkPointer = this._simulationModule.getLinks();
		return this._simulationModule.HEAP8.slice(this._linkPointer, this._linkPointer + this._board.links);
	}

	public getComponents(): Array<{ inputs: Int8Array, outputs: Int8Array }> {
		const ptr = this._simulationModule.getComponents();

		let ptrPosition = ptr;
		const components = new Array(this._board.components.length);
		for (let i = 0; i < this._board.components.length; i++) {
			components[i] = {
				inputs: this._simulationModule.HEAP8.slice(ptrPosition, ptrPosition += this._board.components[i].inputs.length),
				outputs: this._simulationModule.HEAP8.slice(ptrPosition, ptrPosition += this._board.components[i].outputs.length)
			};
		}
		this._simulationModule._free(ptr);
		return components;
	}

	public runTimeout(target: number) {
		while (true) {
			this._simulationModule.startTimeout(target);
			console.log(this._simulationModule.getStatus());
		}
	}

	public runForTarget(target: number) {
		let ticks = 1;
		while (true) {
			const prev = performance.now();
			this._simulationModule.startManual(ticks);

			ticks *= target / (performance.now() - prev);
			console.log(this._simulationModule.getStatus());
		}
	}

	public stop() {
		this._simulationModule.stop();
	}

	public getStatus(): BoardStatus {
		return this._simulationModule.getStatus();
	}

	public printHeap() {
		const map = new Map<number, number>();
		this._simulationModule.HEAP8.forEach((y, z) => {
			if (y !== 0) map.set(z, y);
		});
		console.log(map);
	}

	private _arrayToHeap(typedArray: TypedArray): Pointer {
		const numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
		const ptr = this._simulationModule._malloc(numBytes);
		const heapBytes = new Uint8Array(this._simulationModule.HEAPU8.buffer, ptr, numBytes);
		heapBytes.set(new Uint8Array(typedArray.buffer));
		return ptr;
	}

	public destroy() {
		this._simulationModule.destroy();
		delete this._board;
		delete this._linkPointer;
	}
}
