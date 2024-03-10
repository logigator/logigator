import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {updatePreferences} from '../../functions/update-preferences';
import { availableLanguages, LanguageCode } from '../../i18n';

@Middleware({type: 'before'})
export class DefaultPreferencesMiddleware implements ExpressMiddlewareInterface {
	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (!request.cookies.preferences || !availableLanguages.includes(request.cookies.preferences.lang as LanguageCode)) {
			updatePreferences(request, response, {
				lang: (request.acceptsLanguages().find(accepted => availableLanguages.includes(accepted as LanguageCode)) ?? 'en') as LanguageCode,
				theme: 'dark'
			});
		}
		next();
	}

}
