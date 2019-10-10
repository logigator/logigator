/// <reference lib="webworker" />

interface SimulationModule {
	lengthBytesUTF8(input: string): number;
	stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): number;
	test(): number;
	initLinks(count: number): number;
	initComponents(count: number): number;
	initComponent(index: number, type: string, inputs: number, outputs: number, inputCount: number, outputCount: number): number;
	initBoard(): number;
	start(ticks: number): number;
	stop(): number;
	getCurrentSpeed(): number;
}

importScripts('/assets/wasm/logigator-simulation.js');

const SimulationModule: SimulationModule & EmscriptenModule = Module as any;

Module.onRuntimeInitialized = () => {
	console.log(SimulationModule.initLinks(8));
	console.log(SimulationModule.initComponents(1));

	let index = 0;
	[
		{
			type: 'AND',
			inputs: new Int32Array([1, 2]),
			outputs: new Int32Array([3])
		}
	].forEach((x) => {
		const inputs = _arrayToHeap(x.inputs);
		const outputs = _arrayToHeap(x.outputs);

		console.log(inputs);
		console.log(outputs);

		console.log(SimulationModule.initComponent(index++, x.type, inputs, outputs, x.inputs.length, x.outputs.length));
		console.log(SimulationModule.initBoard());

		while (true) {
			console.log(SimulationModule.start(4000000));
			console.log(SimulationModule.getCurrentSpeed());
		}
	});

	const map = new Map<number, number>();
	SimulationModule.HEAP8.forEach((y, z) => {
		if (y !== 0) map.set(z, y);
	});
	console.log(map);
};

function _arrayToHeap(typedArray) {
	const numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
	const ptr = SimulationModule._malloc(numBytes);
	const heapBytes = new Uint8Array(SimulationModule.HEAPU8.buffer, ptr, numBytes);
	heapBytes.set(new Uint8Array(typedArray.buffer));
	return ptr;
}

addEventListener('message', ({ data }) => {
	const response = `worker response to ${data}`;
	console.log(data);
	postMessage(response);
});
