import {HelperDelegate, HelperOptions} from 'handlebars';
import {Container} from 'typedi';
import {ConfigService} from '../services/config.service';

export function linkHrefHelper(): HelperDelegate {
	const editorUrl = Container.get(ConfigService).getConfig('domains').editor;

	return function(url: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{linkHref}} expects 1 arguments (link: string)');
		}

		if (url === '/') {
			return '/' + options.data.root.preferences.lang;
		}

		// Editor URL is not prefixed with language
		if (url.startsWith(editorUrl)) {
			return url;
		}

		return '/' + options.data.root.preferences.lang + (url.startsWith('/') ? url : '/' + url);
	};
}
