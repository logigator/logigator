import * as fs from 'fs';
import * as path from 'path';

function transform(targetOptions, indexHtml: string): string {
	const warningPopup = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'compatibility-check', 'warning-popup.html')).toString();
	const toInject = `
		${warningPopup}
		<noscript>
			${warningPopup.replace('id="compatibility-warning" style="display: none"', 'id="compatibility-warning"')}
		</noscript>`;

	return indexHtml.replace('<template id="compatibility-warning"></template>', toInject);
}

module.exports = transform;
