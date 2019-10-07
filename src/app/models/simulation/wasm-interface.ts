import {Board} from './board';

export type WasmMethod = 'single' | 'cont' | 'stop' | 'pause' | 'init';

export interface WasmRequest {
	method: WasmMethod;
	board?: Board;
	time?: number;
	userInputs?: Map<number, boolean>;
}

export interface WasmResponse {
	method: WasmMethod;
	success: boolean;
	error: string;
	state: any;
	steps: number;
}

// braucht man startDebug im worker-comm-service? nicht pause+step?
// dafür aber continue
// warum steht im worker-comm-service 'start' als used?
