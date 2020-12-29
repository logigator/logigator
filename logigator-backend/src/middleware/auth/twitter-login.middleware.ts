import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';
import {ConfigService} from '../../services/config.service';
import {getPathnameWithoutLang} from '../../functions/get-path-name-without-lang';
import {TranslationService} from '../../services/translation.service';
import {Container} from 'typedi';

export class TwitterLoginMiddleware implements ExpressMiddlewareInterface {

	private configService = Container.get(ConfigService);
	private translationService = Container.get(TranslationService);

	use(request: Request, response: Response, next: (err?: any) => any): any {
		passport.authenticate('twitter', {
			callbackURL: this.configService.getConfig('passport').twitter.callbackURL + '?state=' + getPathnameWithoutLang(request.get('Referer') as string ?? '/', this.translationService.availableLanguages)
		} as any)(request, response, next);
	}
}
