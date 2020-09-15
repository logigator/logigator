import {ExpressMiddlewareInterface} from "routing-controllers";
import {Request, Response} from "express";
import passport from "passport";

export class TwitterAuthenticationMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next?: (err?: any) => any): any {
		return passport.authenticate('twitter', {
			failureRedirect: '/',
			successRedirect: '/'
		})(request, response, next);
	}

}
