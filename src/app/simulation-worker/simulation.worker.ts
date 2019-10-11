/// <reference lib="webworker" />

import {output} from '../models/element-types/plug/output';

interface SimulationModule {
	lengthBytesUTF8(input: string): number;
	stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): number;
	test(): number;
	initLinks(count: number): number;
	initComponents(count: number): number;
	initComponent(index: number, type: string, inputs: number, outputs: number, inputCount: number, outputCount: number): number;
	initBoard(): number;
	start(): number;
	startManual(ticks: number): number;
	startTimeout(ms: number): number;
	stop(): number;
	getCurrentSpeed(): number;
	getLinks(): number;
}

importScripts('/assets/wasm/logigator-simulation.js');

const SimulationModule: SimulationModule & EmscriptenModule = Module as any;

Module.onRuntimeInitialized = () => {
	initBoard({
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

	SimulationModule.startManual(100);
	SimulationModule.test();
	console.log(getLinks());
};

function initBoard(board: any) {
	SimulationModule.initLinks(board.links);
	SimulationModule.initComponents(board.components.length);

	board.components.forEach((x, i) => {
		x.inputs = new Int32Array(x.inputs);
		x.outputs = new Int32Array(x.outputs);

		const inputPtr = _arrayToHeap(x.inputs);
		const outputPtr = _arrayToHeap(x.outputs);

		SimulationModule.initComponent(i, x.type, inputPtr, outputPtr, x.inputs.length, x.outputs.length);
	});
	SimulationModule.initBoard();
}

function getLinks() {
	const ptr = SimulationModule.getLinks();

	const data = SimulationModule.HEAP8.slice(ptr, ptr + 10);
	SimulationModule._free(ptr);
	return data;
}

function runTimeout(target: number) {
	while (true) {
		SimulationModule.startTimeout(target);
		console.log(SimulationModule.getCurrentSpeed());
	}
}

function runForTarget(target: number) {
	let ticks = 1;
	while (true) {
		const prev = performance.now();
		SimulationModule.startManual(ticks);

		ticks *= target / (performance.now() - prev);
		console.log(SimulationModule.getCurrentSpeed());
	}
}

function _arrayToHeap(typedArray) {
	const numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
	const ptr = SimulationModule._malloc(numBytes);
	const heapBytes = new Uint8Array(SimulationModule.HEAPU8.buffer, ptr, numBytes);
	heapBytes.set(new Uint8Array(typedArray.buffer));
	return ptr;
}

function printHeap() {
	const map = new Map<number, number>();
	SimulationModule.HEAP8.forEach((y, z) => {
		if (y !== 0) map.set(z, y);
	});
	console.log(map);
}

addEventListener('message', ({ data }) => {
	const response = `worker response to ${data}`;
	console.log(data);
	postMessage(response);
});
