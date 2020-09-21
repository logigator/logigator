import {HelperDelegate} from 'handlebars';

export function ternaryHelper(): HelperDelegate {
	return function(condition: boolean, arg0: any, arg1: any) {
		if (arguments.length < 4) {
			throw new Error('handlebars Helper {{ternary}} expects 3 arguments');
		}

		return condition ? arg0 : arg1;
	};
}
