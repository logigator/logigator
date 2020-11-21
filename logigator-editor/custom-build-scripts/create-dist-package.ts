import * as fs from 'fs';
import * as path from 'path';
const packageFile = require('../../package.json');

const toWrite = `
{
  "name": "${packageFile.name}",
  "version": "${packageFile.version}",
  "description": "Logigator Editor",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/logigator/editor.git"
  },
  "main": "electron/main.js",
  "dependencies": ${JSON.stringify(packageFile.electronProdDependencies, null, 2)}
}
`;

fs.writeFileSync(path.join(__dirname, '..', '..', 'dist', 'package.json'), toWrite);
