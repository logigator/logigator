import {HelperDelegate, SafeString} from 'handlebars';

export function safeStringHelper(): HelperDelegate {
	return function(text: string) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{safeString}} expects 1 arguments (text: string)');
		}

		return new SafeString(text);
	};
}
