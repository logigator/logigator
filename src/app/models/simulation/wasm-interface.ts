import {Board} from './board';
import {PowerChangesIn} from './power-changes';

export type WasmMethod = 'single' | 'cont' | 'stop' | 'pause' | 'init';

export interface WasmRequest {
	method: WasmMethod;
	board?: Board;
	time?: number;
	userInputs?: PowerChangesIn;
}

export interface WasmResponse {
	method: WasmMethod;
	success: boolean;
	error: string;
	state: PowerChangesIn;
	steps: number;
}
