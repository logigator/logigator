import {HelperDelegate} from 'handlebars';

export function concatHelper(): HelperDelegate {
	return function(...toConcat) {
		let out = '';
		for (const element of toConcat) {
			if (typeof element !== 'object')
				out += element;
		}
		return out;
	};
}
