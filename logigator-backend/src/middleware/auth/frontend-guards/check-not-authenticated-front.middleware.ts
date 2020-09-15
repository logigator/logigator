import {ExpressMiddlewareInterface} from "routing-controllers";
import {Request, Response} from "express";

export class CheckNotAuthenticatedFrontMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (!!request.user) {
			response.redirect('/');
			return;
		}
		next();
	}

}
