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

	// test();
};

addEventListener('message', ({ data }: {data: WasmRequest}) => {
	if (!initialized) {
		postMessage({
			method: data.method,
			success: false,
			state: new Int8Array(0),
			error: 'WebAssembly is not initialized yet.'
		} as WasmResponse);
		return;
	}

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
			if (!data.board) {
				error = 'No board specified.';
				break;
			}
			if (worker) {
				worker.destroy();
			}
			worker = new SimulationWorker(data.board, Module);
			break;
		case WasmMethod.status:
			postMessage({
				method: data.method,
				success: true,
				state: worker.getLinks(),
				status: worker.getStatus()
			} as WasmResponse);
			return;
		default:
			error = 'Method not found.';
			break;
	}

	if (error)
		postMessage({
			method: data.method,
			success: false,
			state: worker.getLinks() || new Int8Array(0),
			error
		} as WasmResponse);
	else
		postMessage({
			method: data.method,
			success: true,
			state: worker.getLinks() || new Int8Array(0)
		} as WasmResponse);
});

// const test = () => {
// 	worker = new SimulationWorker({
// 		links: 10,
// 		components: [
// 			{
// 				typeId: 2,
// 				inputs: [
// 					8, 9
// 				],
// 				outputs: [
// 					0
// 				]
// 			},
// 			{
// 				typeId: 1,
// 				inputs: [
// 					8
// 				],
// 				outputs: [
// 					1
// 				]
// 			},
// 			{
// 				typeId: 1,
// 				inputs: [
// 					8
// 				],
// 				outputs: [
// 					2
// 				]
// 			},
// 			{
// 				typeId: 4,
// 				inputs: [
// 					1, 2
// 				],
// 				outputs: [
// 					3
// 				]
// 			},
// 			{
// 				typeId: 2,
// 				inputs: [
// 					1, 2
// 				],
// 				outputs: [
// 					4
// 				]
// 			},
// 			{
// 				typeId: 4,
// 				inputs: [
// 					0, 3
// 				],
// 				outputs: [
// 					5
// 				]
// 			},
// 			{
// 				typeId: 2,
// 				inputs: [
// 					0, 3
// 				],
// 				outputs: [
// 					6
// 				]
// 			},
// 			{
// 				typeId: 3,
// 				inputs: [
// 					4, 6
// 				],
// 				outputs: [
// 					7
// 				]
// 			}
// 		]
// 	}, Module);
//
// 	worker.startManual(100);
// 	console.log(worker.getStatus());
// 	console.log(worker.getLinks());
// 	console.log(worker.getComponents());
// };
