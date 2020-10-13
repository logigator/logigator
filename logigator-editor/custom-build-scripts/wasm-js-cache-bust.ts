import * as fs from 'fs';
import * as path from 'path';

const editorDist = path.join(__dirname, '..', '..', 'dist', 'logigator-editor');

const timestamp = Date.now();
const jsWasmFile = path.join(editorDist, 'assets', 'wasm', 'logigator-simulation.js');
const jsWasmFileTimestamp = path.join(editorDist, 'assets', 'wasm', `logigator-simulation.${timestamp}.js`);
const workerJsFiles = fs.readdirSync(editorDist).filter(file => file.endsWith('.worker.js'));

fs.renameSync(jsWasmFile, jsWasmFileTimestamp);
for (let workerFile of workerJsFiles) {
	workerFile = path.join(editorDist, workerFile);
	if(fs.existsSync(workerFile)) {
		fs.writeFileSync(workerFile, fs.readFileSync(workerFile).toString().replace('importScripts(\"assets/wasm/logigator-simulation.js\")', `importScripts(\"/assets/wasm/logigator-simulation.${timestamp}.js\")`));
	}
}
