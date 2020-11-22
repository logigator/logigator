import {HelperDelegate, HelperOptions} from 'handlebars';
import {TranslationService} from '../services/translation.service';
import {Container} from 'typedi';

export function dateHelper(): HelperDelegate {

	const translationService = Container.get(TranslationService);

	return function(value: string, options: HelperOptions) {
		if (arguments.length < 2) {
			throw new Error('handlebars Helper {{si}} expects 1 argument. date: string');
		}

		return translationService.dateFormatDate(value, options.data.root.preferences.lang);
	};
}
