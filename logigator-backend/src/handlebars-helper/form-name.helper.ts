import {HelperDelegate} from 'handlebars';

export function formNameHelper(): HelperDelegate {
	return function(action: string) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formName}} expects 1 arguments');
		}

		const formName = action.replace(/\//g, '_').substr(1);
		this.formData = {
			formName
		};
		return formName;
	};
}
