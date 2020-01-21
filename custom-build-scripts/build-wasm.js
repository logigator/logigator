const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', '@logigator', 'logigator-simulation', 'webAssembly', 'dist');
const dest = path.join(__dirname, '..', 'src', 'assets', 'wasm');

if (fs.existsSync(path.join(source, 'logigator-simulation.js')) && fs.existsSync(path.join(source, 'logigator-simulation.wasm'))) {
	fs.copyFileSync(path.join(source, 'logigator-simulation.wasm'), path.join(dest, 'logigator-simulation.wasm'));
	fs.writeFileSync(path.join(dest, 'logigator-simulation.js'), fs.readFileSync(path.join(source, 'logigator-simulation.js')).toString().replace(/var wasmBinaryFile = '(.*?)';/, 'var wasmBinaryFile = \'assets/wasm/$1\';'));
}
