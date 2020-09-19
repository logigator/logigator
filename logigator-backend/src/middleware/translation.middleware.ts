import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {TranslationService} from '../services/translation.service';

@Middleware({type: 'before'})
export class TranslationMiddleware implements ExpressMiddlewareInterface {

	constructor(private translationService: TranslationService) {}

	use(request: Request, response: Response, next: (err?: any) => any): any {
		response.locals.i18n = this.translationService.getTranslations(request.session.preferences.lang);
		next();
	}

}
