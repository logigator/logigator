import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {TranslationService} from '../../services/translation.service';

@Middleware({type: 'before'})
export class DefaultSessionMiddleware implements ExpressMiddlewareInterface {

	constructor(private translationService: TranslationService) {}

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (!request.session.preferences) {
			request.session.preferences = {
				lang: request.acceptsLanguages().find(accepted => this.translationService.availableLanguages.includes(accepted)) ?? 'en',
				theme: 'dark'
			};
		}
		next();
	}

}
