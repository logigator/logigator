import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
const packageFile = require('../../package.json');

const electronDependencies = {
	'node-fetch': '^2.6.0',
	tslib: '^1.10.0',
};

const toWrite = `
{
  "name": "${packageFile.name}",
  "version": "${packageFile.version}",
  "main": "electron/main.js",
  "dependencies": ${JSON.stringify(electronDependencies, null, 2)}
}
`;

fs.writeFileSync(path.join(__dirname, '..', '..', 'dist', 'package.json'), toWrite);

child_process.exec('npm install', {
	cwd: path.join(__dirname, '..', '..', 'dist')
}, (error, stdout) => {
	console.log(stdout);
	console.error(error);
});
