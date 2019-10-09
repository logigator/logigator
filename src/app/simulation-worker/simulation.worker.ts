/// <reference lib="webworker" />

interface SimulationModule {
	test(): number;
}

importScripts('/assets/wasm/logigator-simulation.js');

const SimulationModule: SimulationModule & EmscriptenModule = Module as any;

Module.onRuntimeInitialized = () => {
	console.log(SimulationModule.test());
};

addEventListener('message', ({ data }) => {
	const response = `worker response to ${data}`;
	console.log(data);
	postMessage(response);
});

/*fetch('assets/simulation.wasm').then(response =>
	response.arrayBuffer()
).then(bytes =>
	WebAssembly.instantiate(bytes, importObject)
);*/
