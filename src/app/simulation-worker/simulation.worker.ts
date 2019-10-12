/// <reference lib="webworker" />

import {Board, BoardState, Pointer, TypedArray, WorkerMethod, SimulationModule} from '../models/simulation/Types';


let initialized = false;
importScripts('/assets/wasm/logigator-simulation.js');
const SimulationModule: SimulationModule & EmscriptenModule = Module as any;
let worker: SimulationWorker;

SimulationModule.onRuntimeInitialized = () => {
	initialized = true;
	postMessage({
		initialized: true
	});

	test();
};

class SimulationWorker {
	private _board: Board;

	constructor(board: Board) {
		SimulationModule.initLinks(board.links);
		SimulationModule.initComponents(board.components.length);

		board.components.forEach((x, i) => {
			const inputs = new Int32Array(x.inputs);
			const outputs = new Int32Array(x.outputs);

			const inputPtr = this._arrayToHeap(inputs);
			const outputPtr = this._arrayToHeap(outputs);

			SimulationModule.initComponent(i, x.type, inputPtr, outputPtr, x.inputs.length, x.outputs.length);
		});
		SimulationModule.initBoard();
		this._board = board;
	}

	public start(ms?: number) {
		if (ms)
			SimulationModule.startTimeout(ms);
		else
			SimulationModule.start();
	}

	public startManual(ticks: number) {
		SimulationModule.startManual(ticks);
	}

	public getLinks(): Int8Array {
		const ptr = SimulationModule.getLinks();

		const data = SimulationModule.HEAP8.slice(ptr, ptr + this._board.links);
		SimulationModule._free(ptr);
		return data;
	}

	public getComponents(): Array<{ inputs: Int8Array, outputs: Int8Array }> {
		const ptr = SimulationModule.getComponents();

		let ptrPosition = ptr;
		const components = new Array(this._board.components.length);
		for (let i = 0; i < this._board.components.length; i++) {
			components[i] = {
				inputs: SimulationModule.HEAP8.slice(ptrPosition, ptrPosition += this._board.components[i].inputs.length),
				outputs: SimulationModule.HEAP8.slice(ptrPosition, ptrPosition += this._board.components[i].outputs.length)
			};
		}
		SimulationModule._free(ptr);
		return components;
	}

	public runTimeout(target: number) {
		while (true) {
			SimulationModule.startTimeout(target);
			console.log(SimulationModule.getStatus());
		}
	}

	public runForTarget(target: number) {
		let ticks = 1;
		while (true) {
			const prev = performance.now();
			SimulationModule.startManual(ticks);

			ticks *= target / (performance.now() - prev);
			console.log(SimulationModule.getStatus());
		}
	}

	public stop() {
		SimulationModule.stop();
	}

	private _arrayToHeap(typedArray: TypedArray): Pointer {
		const numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
		const ptr = SimulationModule._malloc(numBytes);
		const heapBytes = new Uint8Array(SimulationModule.HEAPU8.buffer, ptr, numBytes);
		heapBytes.set(new Uint8Array(typedArray.buffer));
		return ptr;
	}

	public printHeap() {
		const map = new Map<number, number>();
		SimulationModule.HEAP8.forEach((y, z) => {
			if (y !== 0) map.set(z, y);
		});
		console.log(map);
	}

	public getStatus(): BoardState {
		return SimulationModule.getStatus();
	}
}

addEventListener('message', ({ data }) => {
	if (!initialized)
		postMessage({
			error: 'Not initialized.'
		});

	console.log(data);
	let error: string;

	switch (data.method) {
		case WorkerMethod.single:
			worker.startManual(data.ticks ? data.ticks : 1);
			break;
		case WorkerMethod.cont:
			data.time ? worker.start(data.time) : worker.start();
			break;
		case WorkerMethod.stop:
			worker.stop();
			break;
		case WorkerMethod.pause:
			worker.stop();
			break;
		case WorkerMethod.init:
			if (worker) {
				error = 'Already initialized.';
				break;
			}
			if (!data.board) {
				error = 'No board specified.';
				break;
			}
			worker = new SimulationWorker(data.board);
			break;
		default:
			return;
	}

	if (error)
		postMessage({
			method: data.method,
			success: false,
			state: worker.getLinks(),
			error
		});
	else
		postMessage({
			method: data.method,
			success: true,
			state: worker.getLinks()
		});
});

const test = () => {
	worker = new SimulationWorker({
		links: 10,
		components: [
			{
				type: 'AND',
				inputs: [
					8, 9
				],
				outputs: [
					0
				]
			},
			{
				type: 'NOT',
				inputs: [
					8
				],
				outputs: [
					1
				]
			},
			{
				type: 'NOT',
				inputs: [
					8
				],
				outputs: [
					2
				]
			},
			{
				type: 'XOR',
				inputs: [
					1, 2
				],
				outputs: [
					3
				]
			},
			{
				type: 'AND',
				inputs: [
					1, 2
				],
				outputs: [
					4
				]
			},
			{
				type: 'XOR',
				inputs: [
					0, 3
				],
				outputs: [
					5
				]
			},
			{
				type: 'AND',
				inputs: [
					0, 3
				],
				outputs: [
					6
				]
			},
			{
				type: 'OR',
				inputs: [
					4, 6
				],
				outputs: [
					7
				]
			}
		]
	});

	worker.startManual(100);
	console.log(worker.getStatus());
	console.log(worker.getLinks());
	console.log(worker.getComponents());
};
