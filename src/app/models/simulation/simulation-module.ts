import {Pointer} from './wasm-interface';
import {BoardStatus} from './board';
import {SimulationUnit} from './simulation-unit';

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

export type EnvironmentType = 'WEB' | 'NODE' | 'SHELL' | 'WORKER';
export type ValueType = 'number' | 'string' | 'array' | 'boolean';
export type TypeCompatibleWithC = number | string | any[] | boolean;

export type WebAssemblyImports =  Array<{
	name: string;
	kind: string;
}>;

export type WebAssemblyExports = Array<{
	module: string;
	name: string;
	kind: string;
}>;

export interface CCallOpts {
	async?: boolean;
}

interface EmscriptenModule {
	arguments: string[];
	environment: EnvironmentType;
	preInit: Array<() => void>;
	preRun: Array<() => void>;
	postRun: Array<() => void>;
	onAbort: (what: any) => void;
	onRuntimeInitialized: () => void;
	preinitializedWebGLContext: WebGLRenderingContext;
	noInitialRun: boolean;
	noExitRuntime: boolean;
	logReadFiles: boolean;
	filePackagePrefixURL: string;
	wasmBinary: ArrayBuffer;

	Runtime: any;

	ALLOC_NORMAL: number;
	ALLOC_STACK: number;
	ALLOC_STATIC: number;
	ALLOC_DYNAMIC: number;
	ALLOC_NONE: number;

	// USE_TYPED_ARRAYS == 1
	HEAP: Int32Array;
	IHEAP: Int32Array;
	FHEAP: Float64Array;

	// USE_TYPED_ARRAYS == 2
	HEAP8: Int8Array;
	HEAP16: Int16Array;
	HEAP32: Int32Array;
	HEAPU8: Uint8Array;
	HEAPU16: Uint16Array;
	HEAPU32: Uint32Array;
	HEAPF32: Float32Array;
	HEAPF64: Float64Array;

	TOTAL_STACK: number;
	TOTAL_MEMORY: number;
	FAST_MEMORY: number;

	preloadedImages: any;
	preloadedAudios: any;
	print(str: string): void;
	printErr(str: string): void;

	destroy(object: object): void;
	getPreloadedPackage(remotePackageName: string, remotePackageSize: number): ArrayBuffer;
	instantiateWasm(
		imports: WebAssemblyImports,
		successCallback: (module: WebAssembly.Module) => void
	): WebAssemblyExports;
	locateFile(url: string): string;
	onCustomMessage(event: MessageEvent): void;

	ccall(ident: string, returnType: ValueType | null, argTypes: ValueType[], args: TypeCompatibleWithC[], opts?: CCallOpts): any;
	cwrap(ident: string, returnType: ValueType | null, argTypes: ValueType[], opts?: CCallOpts): (...args: any[]) => any;

	setValue(ptr: number, value: any, type: string, noSafe?: boolean): void;
	getValue(ptr: number, type: string, noSafe?: boolean): number;

	allocate(slab: any, types: string | string[], allocator: number, ptr: number): number;

	addOnPreRun(cb: () => any): void;
	addOnInit(cb: () => any): void;
	addOnPreMain(cb: () => any): void;
	addOnExit(cb: () => any): void;
	addOnPostRun(cb: () => any): void;

	// Tools
	intArrayFromString(stringy: string, dontAddNull?: boolean, length?: number): number[];
	intArrayToString(array: number[]): string;
	writeStringToMemory(str: string, buffer: number, dontAddNull: boolean): void;
	writeArrayToMemory(array: number[], buffer: number): void;
	writeAsciiToMemory(str: string, buffer: number, dontAddNull: boolean): void;

	addRunDependency(id: any): void;
	removeRunDependency(id: any): void;

	_malloc(size: number): number;
	_free(ptr: number): void;
}

export interface SimulationModule extends EmscriptenModule {
	lengthBytesUTF8(input: string): number;
	stringToUTF8(str: string, outPtr: Pointer, maxBytesToWrite: number): number;

	test(): number;
	initBoard(): number;
	initLinks(count: number): number;
	initComponents(count: number): number;
	initComponent(index: number, typeId: number, inputs: Pointer, outputs: Pointer, inputCount: number, outputCount: number, op1: number, op2: number): number;

	start(): number;
	startTimeout(ms: number): number;
	startManual(ticks: number): number;
	stop(): number;

	getStatus(): BoardStatus;
	getLinks(): Pointer;
	getComponents(): Pointer;
}
