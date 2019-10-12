import * as fs from 'fs';
import * as path from 'path';
const packageFile = require('../../package.json');

const electronDependencies = {

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
