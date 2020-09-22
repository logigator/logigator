import {Request, Response} from 'express';
import {Container} from 'typedi';
import {TranslationService} from '../../services/translation.service';

export function setTitleMiddleware(title: string) {

	const translationService = Container.get(TranslationService);

	return function (request: Request, response: Response, next: (err?: any) => any): any {
		response.locals.pageTitle = translationService.getTranslation(title, request.session.preferences.lang);
		next();
	};

}
