import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';

export class TwitterLoginMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		passport.authenticate('twitter')(request, response, next);
	}
}
