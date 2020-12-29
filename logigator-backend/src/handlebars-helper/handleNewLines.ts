import {HelperDelegate, SafeString, Utils} from 'handlebars';

export function handleNewLinesHelper(): HelperDelegate {
	return function(text: string) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{handleNewLines}} expects 1 arguments (text: string)');
		}

		return new SafeString(Utils.escapeExpression(text).replace(/\r\n/g, '&#10;').replace(/\n/g, '&#10;'));
	};
}
