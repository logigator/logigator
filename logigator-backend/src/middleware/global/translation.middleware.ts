import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {updatePreferences} from '../../functions/update-preferences';
import { availableLanguages, LanguageCode } from '../../i18n';

@Middleware({type: 'before'})
export class TranslationMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.url.startsWith('/api')) {
			next();
			return;
		}

		const langMatches = request.url.match(/^\/(\w\w)/);
		if (langMatches && availableLanguages.includes(langMatches[1] as LanguageCode) && (request.url.length === 3 || request.url.charAt(3) === '/')) {
			let rewrittenUrl = request.url.substring(3);
			if (!rewrittenUrl.startsWith('/')) {
				rewrittenUrl = '/' + rewrittenUrl;
			}
			request.url = rewrittenUrl;

			updatePreferences(request, response, {
				lang: langMatches[1] as LanguageCode
			});
		}
		next();
	}

}
