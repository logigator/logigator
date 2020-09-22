import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {TranslationService} from '../../services/translation.service';

@Middleware({type: 'before'})
export class TranslationMiddleware implements ExpressMiddlewareInterface {

	constructor(private translationService: TranslationService) {}

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.url.startsWith('/api')) {
			next();
			return;
		}

		const langMatches = request.url.match(/^\/(\w\w)/);
		if (langMatches && this.translationService.availableLanguages.includes(langMatches[1]) && (request.url.length === 3 || request.url.charAt(3) === '/')) {
			let rewrittenUrl = request.url.substring(3);
			if (!rewrittenUrl.startsWith('/')) {
				rewrittenUrl = '/' + rewrittenUrl;
			}
			request.url = rewrittenUrl;
			request.session.preferences.lang = langMatches[1];
		}
		next();
	}

}
