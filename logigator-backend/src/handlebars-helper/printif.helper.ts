import {HelperDelegate} from 'handlebars';

export function printIfHelper(): HelperDelegate {
	return (condition: boolean, toPrint: any) => {
		if (condition) {
			return toPrint;
		}
		return undefined;
	};
}
