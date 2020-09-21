import {HelperDelegate} from 'handlebars';

export function printIfHelper(): HelperDelegate {
	return function(condition: boolean, toPrint: any) {
		if (arguments.length < 3) {
			throw new Error('handlebars Helper {{printIf}} expects 2 arguments');
		}

		if (condition) {
			return toPrint;
		}
		return undefined;
	};
}
