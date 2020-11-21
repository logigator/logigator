const packager = require('electron-packager');
import * as path from 'path';

const platform = process.argv[2];
const arch = process.argv[3];

if (!platform || !arch) {
	process.exit();
}


const options = {
	arch,
	platform,
	dir: path.join(__dirname, '..', '..', 'dist'),
	'app-copyright': 'HTL Rennweg',
	asar: true,
	icon: path.join(__dirname, '..', '..', 'src', 'icon256.ico'),
	name: 'Logigator',
	out: path.join(__dirname, '..', '..', 'release'),
	overwrite: true,
	prune: true,
	'version-string': {
		CompanyName: 'HTL Rennweg',
		FileDescription: 'Logigator',
		OriginalFilename: 'Logigator',
		ProductName: 'Logigator',
		InternalName: 'Logigator'
	}
};

packager(options)
	.then(console.log)
	.catch(console.log);
