import {BadRequestError, ExpressMiddlewareInterface} from "routing-controllers";
import {Request, Response} from "express";

export class CheckNotAuthenticatedApiMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.user) {
			throw new BadRequestError(request.path + ' cannot be used by authenticated users');
		}
		next();
	}

}
