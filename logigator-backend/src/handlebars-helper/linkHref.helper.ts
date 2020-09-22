import {HelperDelegate} from 'handlebars';

export function linkHrefHelper(): HelperDelegate {
	return function(url: string) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{linkHref}} expects 1 arguments (link: string)');
		}

		return '/' + this.preferences.lang + (url.startsWith('/') ? url : '/' + url);
	};
}
