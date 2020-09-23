import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';

export class LocalAuthenticationMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next?: (err?: any) => any): any {
		return passport.authenticate('local', {
			failureRedirect: '/',
			successRedirect: '/'
		})(request, response, next);
	}

}
