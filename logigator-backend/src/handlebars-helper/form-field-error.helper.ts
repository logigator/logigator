import {HelperDelegate, HelperOptions} from 'handlebars';

export function formFieldErrorHelper(): HelperDelegate {
	return function(errorName: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formFieldError}} expects 1 argument string (errorName)');
		}

		if (this.formErrors?.[options.data.formName]?.[options.data.fieldName]?.errors?.includes(errorName)) {
			return options.fn(this);
		}
	};
}
