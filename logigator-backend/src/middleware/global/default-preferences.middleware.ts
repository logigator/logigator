import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {TranslationService} from '../../services/translation.service';
import {updatePreferences} from '../../functions/update-preferences';

@Middleware({type: 'before'})
export class DefaultPreferencesMiddleware implements ExpressMiddlewareInterface {

	constructor(private translationService: TranslationService) {}

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (!request.cookies.preferences) {
			updatePreferences(request, response, {
				lang: request.acceptsLanguages().find(accepted => this.translationService.availableLanguages.includes(accepted)) ?? 'en',
				theme: 'dark'
			});
		}
		next();
	}

}
