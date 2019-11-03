/// <reference lib="webworker" />

import {SimulationModule} from '../models/simulation/simulation-module';
import {WasmMethod, WasmRequest, WasmResponse} from '../models/simulation/wasm-interface';
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
		case WasmMethod.reset:
			if (!worker) {
				error = 'Not yet initialized.';
				break;
			}
			worker.destroy();
			worker = new SimulationWorker(worker.getBoard, Module);
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
