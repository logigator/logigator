import {HelperDelegate, createFrame, HelperOptions} from 'handlebars';

export function formNameScopeHelper(): HelperDelegate {
	return function(action: string, namePrefix: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formNameScope}} expects 1 or 2 arguments string (action)');
		}
		if (arguments.length === 2) {
			options = namePrefix as any as HelperOptions;
			namePrefix = undefined;
		}

		let formName = action.replace(/\//g, '_').substr(1);

		if (namePrefix) {
			formName = namePrefix + formName;
		}

		const data = createFrame(options.data);
		data.formName = formName;

		return options.fn(this, {data: data});
	};
}
