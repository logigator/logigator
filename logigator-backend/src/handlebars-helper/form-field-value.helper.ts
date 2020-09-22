import {HelperDelegate, HelperOptions} from 'handlebars';

export function formFieldValueHelper(): HelperDelegate {
	return function(fieldName: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formFieldValue}} expects 1 argument string (fieldName)');
		}

		return this.formErrors?.[options.data.formName]?.[fieldName]?.value;
	};
}
