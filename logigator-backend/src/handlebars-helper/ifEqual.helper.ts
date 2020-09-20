import {HelperDelegate} from 'handlebars';

export function ifEqualHelper(): HelperDelegate {
	return function (arg0: any, arg1: any, options: any) {
		if (arg0 === arg1) {
			return options.fn(this);
		}
	};
}
