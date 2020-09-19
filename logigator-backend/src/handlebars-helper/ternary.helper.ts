import {HelperDelegate} from 'handlebars';

export function ternaryHelper(): HelperDelegate {
	return (condition: boolean, arg0: any, arg1: any) => {
		return condition ? arg0 : arg1;
	};
}
