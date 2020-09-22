import {HelperDelegate} from 'handlebars';

export function propertyExistsHelper(): HelperDelegate {
	return function(prop: string) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{propertyExists}} expects 1 arguments');
		}

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let contextToCheck = this;

		const propParts = prop.split('.');
		for (let i = 0; i < propParts.length; i++) {
			if (contextToCheck !== undefined && contextToCheck !== null && propParts[i] in contextToCheck) {
				contextToCheck = contextToCheck[propParts[i]];
			} else {
				return false;
			}
		}
		return true;
	};
}
