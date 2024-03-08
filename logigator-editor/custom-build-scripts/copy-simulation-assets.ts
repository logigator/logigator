/**
 * This script copies the wasm and js files from the logigator-simulation package to the assets folder.
 * It also adds a hash to the wasm file name to bust browser caching.
 * The js file is not hashed, because it is hashed by the wasm-js-cache-bust script.
 */

import { readFile, writeFile, readdir, unlink, copyFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { exit } from 'process';

const source = join(
	__dirname,
	'..',
	'..',
	'node_modules',
	'@logigator',
	'logigator-simulation',
	'webAssembly',
	'dist'
);
const dest = join(__dirname, '..', '..', 'src', 'assets', 'wasm');

const wasmPath = join(source, 'logigator-simulation.wasm');
const jsPath = join(source, 'logigator-simulation.js');

async function run() {
	let [wasmFile, jsFile] = await Promise.all([
		readFile(wasmPath),
		readFile(jsPath, { encoding: 'utf-8' })
	]);

	const wasmHash = createHash('md5').update(wasmFile).digest('base64url');

	jsFile = jsFile.replace(
		/var wasmBinaryFile ?= ?["'](.*?)["'];/,
		`var wasmBinaryFile=\'assets/wasm/logigator-simulation.${wasmHash}.wasm\';`
	);

	const existingFiles = await readdir(dest, { recursive: false });
	await Promise.all(
		existingFiles
			.filter((file) => file.match(/logigator-simulation\..*\.(wasm|js)/))
			.map((file) => unlink(join(dest, file)))
	);

	await Promise.all([
		copyFile(wasmPath, join(dest, `logigator-simulation.${wasmHash}.wasm`)),
		writeFile(join(dest, `logigator-simulation.js`), jsFile)
	]);
}

run().catch((err) => {
	console.error(err);
	exit(1);
});
