import {Pointer} from './wasm-interface';
import {BoardState} from './board';

export interface SimulationModule {
	lengthBytesUTF8(input: string): number;
	stringToUTF8(str: string, outPtr: Pointer, maxBytesToWrite: number): number;

	test(): number;
	initBoard(): number;
	initLinks(count: number): number;
	initComponents(count: number): number;
	initComponent(index: number, type: string, inputs: Pointer, outputs: Pointer, inputCount: number, outputCount: number): number;

	start(): number;
	startTimeout(ms: number): number;
	startManual(ticks: number): number;
	stop(): number;

	getStatus(): BoardState;
	getLinks(): Pointer;
	getComponents(): Pointer;
}

export type TypedArray =
	Int8Array |
	Uint8Array |
	Uint8ClampedArray |
	Int16Array |
	Uint16Array |
	Int32Array |
	Uint32Array |
	Float32Array |
	Float64Array;
