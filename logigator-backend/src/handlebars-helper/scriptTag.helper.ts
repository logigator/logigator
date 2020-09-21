import {HelperDelegate, HelperOptions, SafeString} from 'handlebars';
import md5 from 'md5';
import * as fs from 'fs';
import * as path from 'path';
import {Container} from 'typedi';
import {ConfigService} from '../services/config.service';

export function scriptTagHelper(): HelperDelegate {

	const appContext = Container.get(ConfigService).getConfig('app-context');
	const srcAttrCache = new Map<string, string>();

	return function(options: HelperOptions) {
		if (!('url' in options.hash) ) {
			throw new Error('handlebars Helper {{scriptTag}} expects 1 or 2 arguments. url: string, type?: "module" | "nomodule"');
		}

		let out = '<script defer ';

		if (options.hash.type === 'module') {
			out += 'type="module" ';
		} else if (options.hash.type === 'nomodule') {
			out += 'nomodule ';
		}

		let srcAttr: string;

		if (appContext === 'production') {
			if (srcAttrCache.has(options.hash.url)) {
				srcAttr = srcAttrCache.get(options.hash.url);
			} else {
				srcAttr = generateSrcAttr(options.hash.url);
				srcAttrCache.set(options.hash.url, srcAttr);
			}
		} else {
			srcAttr = generateSrcAttr(options.hash.url);
		}

		out += `${srcAttr}></script>`;
		return new SafeString(out);
	};

	function generateSrcAttr(url: string): string {
		const filePath = path.join(__dirname, '..', '..', 'resources', 'public', url);
		const fileMd5 = md5(fs.readFileSync(filePath));
		return `src="${url}?${fileMd5}"`;
	}
}
