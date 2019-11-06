import * as fs from 'fs';
import * as path from 'path';

function transform(targetOptions, indexHtml: string): string {
	const warningPopup = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'compatibility-check', 'warning-popup.html')).toString();
	return indexHtml.replace('<template id="compatibility-warning"></template>', warningPopup);
}

module.exports = transform;
