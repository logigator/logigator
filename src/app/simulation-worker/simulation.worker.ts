/// <reference lib="webworker" />

import {Board, BoardState} from '../models/simulation/board';
import {SimulationModule, TypedArray} from '../models/simulation/simulation-module';
import {Pointer, WasmMethod, WasmRequest, WasmResponse} from '../models/simulation/wasm-interface';
import {SimulationWorker} from '../models/simulation/simulation-worker';

let initialized = false;
let worker: SimulationWorker;

importScripts('/assets/wasm/logigator-simulation.js');
declare var Module: SimulationModule;

Module.onRuntimeInitialized = () => {
	initialized = true;
	postMessage({
		initialized: true
	});

	test();
};

addEventListener('message', ({ data }: {data: WasmRequest}) => {
	if (!initialized)
		postMessage({
			error: 'WebAssembly not initialized yet.'
		});

	console.log(data);
	let error: string;

	switch (data.method) {
		case WasmMethod.single:
			worker.startManual(data.ticks ? data.ticks : 1);
			break;
		case WasmMethod.cont:
			data.time ? worker.start(data.time) : worker.start();
			break;
		case WasmMethod.stop:
			worker.stop();
			break;
		case WasmMethod.pause:
			worker.stop();
			break;
		case WasmMethod.init:
			if (worker) {
				error = 'Already initialized.';
				break;
			}
			if (!data.board) {
				error = 'No board specified.';
				break;
			}
			worker = new SimulationWorker(data.board, Module);
			break;
		case WasmMethod.status:
			postMessage({
				method: data.method,
				success: false,
				state: worker.getLinks(),
				status: worker.getStatus()
			} as WasmResponse);
			return;
		default:
			return;
	}

	if (error)
		postMessage({
			method: data.method,
			success: false,
			state: worker.getLinks(),
			error
		} as WasmResponse);
	else
		postMessage({
			method: data.method,
			success: true,
			state: worker.getLinks()
		} as WasmResponse);
});

const test = () => {
	worker = new SimulationWorker({
		links: 10,
		components: [
			{
				// @ts-ignore
				typeId: 'AND',
				inputs: [
					8, 9
				],
				outputs: [
					0
				]
			},
			{
				// @ts-ignore
				typeId: 'NOT',
				inputs: [
					8
				],
				outputs: [
					1
				]
			},
			{
				// @ts-ignore
				typeId: 'NOT',
				inputs: [
					8
				],
				outputs: [
					2
				]
			},
			{
				// @ts-ignore
				typeId: 'XOR',
				inputs: [
					1, 2
				],
				outputs: [
					3
				]
			},
			{
				// @ts-ignore
				typeId: 'AND',
				inputs: [
					1, 2
				],
				outputs: [
					4
				]
			},
			{
				// @ts-ignore
				typeId: 'XOR',
				inputs: [
					0, 3
				],
				outputs: [
					5
				]
			},
			{
				// @ts-ignore
				typeId: 'AND',
				inputs: [
					0, 3
				],
				outputs: [
					6
				]
			},
			{
				// @ts-ignore
				typeId: 'OR',
				inputs: [
					4, 6
				],
				outputs: [
					7
				]
			}
		]
	}, Module);

	worker.startManual(100);
	console.log(worker.getStatus());
	console.log(worker.getLinks());
	console.log(worker.getComponents());
};
