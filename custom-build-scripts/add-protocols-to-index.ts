import * as fs from 'fs';
import * as path from 'path';

const index = path.join(__dirname, '..', '..', 'dist', 'logigator-editor', 'index.html');

let data = fs.readFileSync(index).toString();
data = data.replace(/src="/g, 'src=\"jsmod://');
fs.writeFileSync(index, data);
