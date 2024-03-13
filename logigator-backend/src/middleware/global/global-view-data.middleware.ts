import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {TranslationService} from '../../services/translation.service';
import { availableLanguages } from '../../i18n';
import { ConfigService } from '../../services/config.service';

@Middleware({type: 'before', priority: -1})
export class GlobalViewDataMiddleware implements ExpressMiddlewareInterface {

	constructor(private translationService: TranslationService, private configService: ConfigService) {}

	use(request: Request, response: Response, next: (err?: any) => any): any {
		response.locals.i18n = this.translationService.getTranslations(request.cookies.preferences.lang);

		const domain: string = this.configService.getConfig('domains').rootUrl;
		response.locals.altPages = [
			...availableLanguages.map(lang => {
				return {
					lang,
					href: `${domain}/${lang}${request.url}`
				};
			}),
			{
				lang: 'x-default',
				href: `${domain}${request.url}`
			}
		];

		response.locals.formErrors = request.session.formErrors;
		request.session.formErrors = undefined;

		response.locals.infoPopup = request.session.infoPopup;
		request.session.infoPopup = undefined;

		next();
	}

}
