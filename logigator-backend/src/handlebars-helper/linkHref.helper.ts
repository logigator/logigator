import {HelperDelegate, HelperOptions} from 'handlebars';

export function linkHrefHelper(): HelperDelegate {
	return function(url: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{linkHref}} expects 1 arguments (link: string)');
		}

		return '/' + options.data.root.preferences.lang + (url.startsWith('/') ? url : '/' + url);
	};
}
