import {HelperDelegate, HelperOptions} from 'handlebars';

export function formFieldValueHelper(): HelperDelegate {
	return function(fieldName: string, defaultValue: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formFieldValue}} expects 1 or 2 arguments string (fieldName, defaultValue?)');
		}
		if (arguments.length === 2) {
			options = defaultValue as any as HelperOptions;
			defaultValue = undefined;
		}

		return this.formErrors?.[options.data.formName]?.[fieldName]?.value ?? defaultValue;
	};
}
