import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {TranslationService} from '../../services/translation.service';

@Middleware({type: 'before'})
export class GlobalViewDataMiddleware implements ExpressMiddlewareInterface {

	constructor(private translationService: TranslationService) {}

	use(request: Request, response: Response, next: (err?: any) => any): any {
		response.locals.i18n = this.translationService.getTranslations(request.cookies.preferences.lang);

		response.locals.formErrors = request.session.formErrors;
		request.session.formErrors = undefined;

		response.locals.infoPopup = request.session.infoPopup;
		request.session.infoPopup = undefined;

		next();
	}

}
