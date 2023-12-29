/**
 * This script is used to cache bust the js file of the logigator-simulation package.
 */

import { join } from 'path';
import { readdir, readFile, writeFile, rename } from 'fs/promises';
import { createHash } from 'crypto';

const editorDist = join(__dirname, '..', '..', 'dist', 'logigator-editor');
const jsFilePath = join(
	editorDist,
	'assets',
	'wasm',
	'logigator-simulation.js'
);

async function run() {
	const jsFile = await readFile(jsFilePath);
	const jsHash = createHash('md5').update(jsFile).digest('base64url');
	await rename(
		jsFilePath,
		join(editorDist, 'assets', 'wasm', `logigator-simulation.${jsHash}.js`)
	);

	const files = (await readdir(editorDist, { recursive: false })).filter(
		(file) => file.endsWith('.js')
	);

	for (const filename of files) {
		const filePath = join(editorDist, filename);
		const content = await readFile(filePath, { encoding: 'utf-8' });

		if (
			!content.includes('importScripts("assets/wasm/logigator-simulation.js")')
		) {
			continue;
		}

		await writeFile(
			filePath,
			content.replace(
				'importScripts("assets/wasm/logigator-simulation.js")',
				`importScripts(\"assets/wasm/logigator-simulation.${jsHash}.js\")`
			)
		);
		break;
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
