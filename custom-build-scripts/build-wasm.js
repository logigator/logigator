const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', '@logigator', 'logigator-simulation', 'webAssembly', 'dist');
const dest = path.join(__dirname, '..', 'src', 'assets', 'wasm');

const timestamp = Date.now();

if (fs.existsSync(path.join(source, 'logigator-simulation.js')) && fs.existsSync(path.join(source, 'logigator-simulation.wasm'))) {
	fs.readdirSync(dest)
		.filter(file => file.endsWith('.wasm'))
		.forEach(file => {
			fs.unlinkSync(path.join(dest, file));
		});
	fs.copyFileSync(path.join(source, 'logigator-simulation.wasm'), path.join(dest, `logigator-simulation.${timestamp}.wasm`));
	fs.writeFileSync(path.join(dest, 'logigator-simulation.js'), fs.readFileSync(path.join(source, 'logigator-simulation.js')).toString().replace(/var wasmBinaryFile ?= ?["'](.*?)["'];/, `var wasmBinaryFile = \'assets/wasm/logigator-simulation.${timestamp}.wasm\';`));
}
