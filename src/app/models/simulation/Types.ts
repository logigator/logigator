export enum BoardState {
	Uninitialized,
	Stopped,
	Running,
	Stopping
}

export enum WorkerMethod {
	single,
	cont,
	stop,
	pause,
	init
}

export type Pointer = number;

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

export interface Component {
	type: string;
	inputs: Array<number>;
	outputs: Array<number>;
}

export interface Board {
	links: number;
	components: Array<Component>;
}

export interface BoardStatus {
	tick: number;
	speed: number;
	state: BoardState;
	componentCount: number;
	linkCount: number;
}

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

export interface WorkerRequestMessage {
	method: WorkerMethod;
	board?: Board;
	ticks?: number;
	time?: number;
	input_changes?: object;
}

export interface WorkerResponseMessage {
	method: WorkerMethod;
	success: boolean;
	state: Array<boolean>;
	tick: number;
	error?: string;
}
