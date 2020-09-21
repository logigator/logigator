import {HelperDelegate, HelperOptions} from 'handlebars';

export function ifEqualHelper(): HelperDelegate {
	return function (arg0: any, arg1: any, options: HelperOptions) {
		if (arguments.length < 3) {
			throw new Error('handlebars Helper {{ifEqual}} expects 2 arguments');
		}

		if (arg0 === arg1) {
			return options.fn(this);
		} else {
			return options.inverse(this);
		}
	};
}
