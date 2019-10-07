/// <reference lib="webworker" />

let importObject = {
	imports: {
		imported_func(arg) {
			console.log(arg);
		}
	}
};

fetch('assets/simulation.wasm').then(response =>
	response.arrayBuffer()
).then(bytes =>
	WebAssembly.instantiate(bytes)
);

addEventListener('message', ({ data }) => {
	const response = `worker response to ${data}`;
	console.log(data);
	postMessage(response);
});
