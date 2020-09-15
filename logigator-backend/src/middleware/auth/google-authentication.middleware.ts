import {ExpressMiddlewareInterface, UnauthorizedError} from "routing-controllers";
import {Request, Response} from "express";
import passport from "passport";

export class GoogleAuthenticationMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next?: (err?: any) => any): any {
		return passport.authenticate('google', {
			failureRedirect: '/',
			successRedirect: '/'
		})(request, response, next);
	}

}
