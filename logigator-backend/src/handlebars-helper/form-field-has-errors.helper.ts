import {HelperDelegate, HelperOptions} from 'handlebars';

export function formFieldHasErrorsHelper(): HelperDelegate {
	return function(fieldName: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formFieldHasError}} expects 1 argument string (fieldName)');
		}

		if (this.formErrors?.[options.data.formName]?.[fieldName]?.errors) {
			return options.fn(this);
		}
	};
}
