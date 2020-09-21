import {HelperDelegate, HelperOptions, SafeString} from 'handlebars';
import md5 from 'md5';
import * as fs from 'fs';
import * as path from 'path';
import {Container} from 'typedi';
import {ConfigService} from '../services/config.service';

export function styleTagHelper(): HelperDelegate {

	const appContext = Container.get(ConfigService).getConfig('app-context');
	const hrefAttrCache = new Map<string, string>();

	return function(options: HelperOptions) {
		if (!('url' in options.hash) ) {
			throw new Error('handlebars Helper {{styleTag}} expects 1 argument. url: string');
		}

		let out = '<link rel="stylesheet" type="text/css" ';

		let hrefAttr: string;

		if (appContext === 'production') {
			if (hrefAttrCache.has(options.hash.url)) {
				hrefAttr = hrefAttrCache.get(options.hash.url);
			} else {
				hrefAttr = generateHrefAttr(options.hash.url);
				hrefAttrCache.set(options.hash.url, hrefAttr);
			}
		} else {
			hrefAttr = generateHrefAttr(options.hash.url);
		}

		out += `${hrefAttr}>`;
		return new SafeString(out);
	};

	function generateHrefAttr(url: string): string {
		const filePath = path.join(__dirname, '..', '..', 'resources', 'public', url);
		const fileMd5 = md5(fs.readFileSync(filePath));
		return `href="${url}?${fileMd5}"`;
	}
}
