import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';

export class GoogleLoginMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		passport.authenticate('google', {
			scope: ['https://www.googleapis.com/auth/userinfo.email', 'profile'],
			prompt: 'select_account',
			state: request.query.form as string
		})(request, response, next);
	}
}
