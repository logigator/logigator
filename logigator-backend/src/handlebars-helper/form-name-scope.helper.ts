import {HelperDelegate, createFrame, HelperOptions} from 'handlebars';

export function formNameScopeHelper(): HelperDelegate {
	return function(action: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{formNameScope}} expects 1 argument string (action)');
		}

		const formName = action.replace(/\//g, '_').substr(1);

		const data = createFrame(options.data);
		data.formName = formName;

		return options.fn(this, {data: data});
	};
}
