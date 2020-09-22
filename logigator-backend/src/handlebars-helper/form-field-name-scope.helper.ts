import {HelperDelegate, createFrame, HelperOptions} from 'handlebars';

export function formFieldNameScopeHelper(): HelperDelegate {
	return function(fieldName: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formFieldNameScope}} expects 1 argument string (fieldName)');
		}

		const data = createFrame(options.data);
		data.fieldName = fieldName;

		return options.fn(this, {data: data});
	};
}
