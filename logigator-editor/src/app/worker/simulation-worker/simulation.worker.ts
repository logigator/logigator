// @ts-strict-ignore
/// <reference lib="webworker" />

import { SimulationModule } from '../../models/simulation/simulation-module';
import {
	WasmMethod,
	WasmRequest,
	WasmResponse
} from '../../models/simulation/wasm-interface';
import { SimulationWorker } from '../../models/simulation/simulation-worker';

let initialized = false;
let worker: SimulationWorker;

importScripts('assets/wasm/logigator-simulation.js');
declare let Module: SimulationModule;

Module.onRuntimeInitialized = () => {
	initialized = true;
	postMessage({
		initialized: true
	});
};

addEventListener('message', ({ data }: { data: WasmRequest }) => {
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
		case WasmMethod.run:
			worker.start(data.ticks, data.time);
			break;
		case WasmMethod.triggerInput:
			if (!data.userInput) {
				error = 'No user inputs received.';
				break;
			}
			worker.triggerInput(
				data.userInput.index,
				data.userInput.inputEvent,
				new Int8Array(data.userInput.state)
			);
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
				state: worker.getLinks().buffer,
				status: worker.getStatus()
			} as WasmResponse);
			return;
		default:
			error = 'Method not found.';
			break;
	}

	const buffer = worker.getLinks().buffer || new ArrayBuffer(0);
	if (error) {
		postMessage(
			{
				method: data.method,
				success: false,
				state: buffer,
				error
			} as WasmResponse,
			[buffer]
		);
	} else {
		postMessage(
			{
				method: data.method,
				success: true,
				state: buffer
			} as WasmResponse,
			[buffer]
		);
	}
});
