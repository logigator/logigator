/// <reference lib="webworker" />

interface SimulationModule {
	test(): number;
}

declare var SimulationModule: SimulationModule & EmscriptenModule;

importScripts('/assets/simulation.js');

addEventListener('message', ({ data }) => {
	const response = `worker response to ${data}`;
	console.log(data);
	postMessage(response);
});

SimulationModule.onRuntimeInitialized = () => {
	console.log(SimulationModule.test());
};

/*fetch('assets/simulation.wasm').then(response =>
	response.arrayBuffer()
).then(bytes =>
	WebAssembly.instantiate(bytes, importObject)
);*/
