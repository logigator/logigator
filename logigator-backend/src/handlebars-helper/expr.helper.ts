import {HelperDelegate} from 'handlebars';

export function exprHelper(): HelperDelegate {
	return function (arg0: any, expression: string, arg1: any) {
		if (arguments.length < 4) {
			throw new Error('handlebars Helper {{expr}} expects 3 arguments');
		}

		let result: boolean;

		switch (expression) {
			case '==':
				result = arg0 == arg1;
				break;
			case '===':
				result = arg0 === arg1;
				break;
			case '!=':
				result = arg0 != arg1;
				break;
			case '!==':
				result = arg0 !== arg1;
				break;
			case '<':
				result = Number(arg0) < Number(arg1);
				break;
			case '>':
				result = Number(arg0) > Number(arg1);
				break;
			case '<=':
				result = Number(arg0) <= Number(arg1);
				break;
			case '>=':
				result = Number(arg0) >= Number(arg1);
				break;
			default:
				throw new Error('helper {{expr}}: invalid operator: `' + expression + '`');
		}

		return result;
	};
}
