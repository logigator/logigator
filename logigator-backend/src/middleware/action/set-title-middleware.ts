import {Request, Response} from 'express';
import {Container} from 'typedi';
import {TranslationService} from '../../services/translation.service';
import {setTitle} from '../../functions/set-title';

export function setTitleMiddleware(title: string) {

	const translationService = Container.get(TranslationService);

	return function (request: Request, response: Response, next: (err?: any) => any): any {
		setTitle(response, translationService.getTranslation(title, request.cookies.preferences.lang));
		next();
	};

}
