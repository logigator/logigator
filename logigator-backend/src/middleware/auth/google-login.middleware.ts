import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';
import {getPathnameWithoutLang} from '../../functions/get-path-name-without-lang';
import {TranslationService} from '../../services/translation.service';
import {Container} from 'typedi';

export class GoogleLoginMiddleware implements ExpressMiddlewareInterface {

	private translationService = Container.get(TranslationService);

	use(request: Request, response: Response, next: (err?: any) => any): any {
		passport.authenticate('google', {
			scope: ['https://www.googleapis.com/auth/userinfo.email', 'profile'],
			prompt: 'select_account',
			state: getPathnameWithoutLang(request.get('Referer') as string ?? '/', this.translationService.availableLanguages)
		})(request, response, next);
	}
}
