import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';
import {getPathnameWithoutLang} from '../../functions/get-path-name-without-lang';

export class GoogleLoginMiddleware implements ExpressMiddlewareInterface {
	use(request: Request, response: Response, next: (err?: any) => any): any {
		passport.authenticate('google', {
			scope: ['https://www.googleapis.com/auth/userinfo.email', 'profile'],
			prompt: 'select_account',
			state: getPathnameWithoutLang(request.get('Referer') as string ?? '/')
		})(request, response, next);
	}
}
