import * as fs from 'fs';
import * as path from 'path';

const editorDist = path.join(__dirname, '..', '..', 'dist', 'logigator-editor');

const timestamp = Date.now();
const jsWasmFile = path.join(editorDist, 'assets', 'wasm', 'logigator-simulation.js');
const jsWasmFileTimestamp = path.join(editorDist, 'assets', 'wasm', `logigator-simulation.${timestamp}.js`);
const workerJsFile = fs.readdirSync(editorDist).find(file => file.endsWith('.worker.js'));

if(fs.existsSync(jsWasmFile)) {
	fs.renameSync(jsWasmFile, jsWasmFileTimestamp);
	fs.writeFileSync(path.join(editorDist, workerJsFile), fs.readFileSync(path.join(editorDist, workerJsFile)).toString().replace('importScripts(\"/assets/wasm/logigator-simulation.js\")', `importScripts(\"/assets/wasm/logigator-simulation.${timestamp}.js\")`));
}

