import {Board, BoardStatus} from './board';
import {PowerChangesIn} from './power-changes';

export type Pointer = number;

export enum WasmMethod {
	single,
	cont,
	stop,
	pause,
	init,
	status,
	reset
}

export interface WasmRequest {
	method: WasmMethod;
	board?: Board;
	ticks?: number;
	time?: number;
	userInputs?: PowerChangesIn;
}

export interface WasmResponse {
	method: WasmMethod;
	success: boolean;
	state: ArrayBuffer;
	status?: BoardStatus;
	error?: string;
}
