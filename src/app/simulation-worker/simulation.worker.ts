/// <reference lib="webworker" />

importScripts('/assets/simulation.js');
declare var Module;

setTimeout(() => {
	console.log(Module.test());
}, 1000);

/*fetch('assets/simulation.wasm').then(response =>
	response.arrayBuffer()
).then(bytes =>
	WebAssembly.instantiate(bytes, importObject)
);*/

addEventListener('message', ({ data }) => {
	const response = `worker response to ${data}`;
	console.log(data);
	postMessage(response);
});
