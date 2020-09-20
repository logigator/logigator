import {HelperDelegate} from 'handlebars';

export function formNameHelper(): HelperDelegate {
	return function(action: string) {
		const formName = action.replace(/\//g, '_').substr(1);
		this.formData = {
			formName
		};
		return formName;
	};
}
