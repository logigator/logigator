import { Board, BoardStatus, InputEvent } from './board';
import { PowerChangeIn } from './power-changes';

export type Pointer = number;

export const enum WasmMethod {
	run,
	triggerInput,
	init,
	status,
	reset
}

export interface WasmRequest {
	method: WasmMethod;
	board?: Board;
	ticks?: number;
	time?: number;
	userInput?: PowerChangeIn;
}

export interface WasmResponse {
	method: WasmMethod;
	success: boolean;
	state: ArrayBuffer;
	status?: BoardStatus;
	error?: string;
}
