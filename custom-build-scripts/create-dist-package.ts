import * as fs from 'fs';
import * as path from 'path';
const packageFile = require('../../package.json');

const electronDependencies = {
	'node-fetch': '^2.6.0',
	tslib: '^1.10.0',
	express: '^4.17.1',
	'@logigator/logigator-simulation': 'latest'
};

const toWrite = `
{
  "name": "${packageFile.name}",
  "version": "${packageFile.version}",
  "description": "Logigator Editor",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/logigator/logigator-editor.git"
  },
  "main": "electron/main.js",
  "dependencies": ${JSON.stringify(electronDependencies, null, 2)}
}
`;

fs.writeFileSync(path.join(__dirname, '..', '..', 'dist', 'package.json'), toWrite);
