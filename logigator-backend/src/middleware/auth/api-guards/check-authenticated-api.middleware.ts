import {ExpressMiddlewareInterface, UnauthorizedError} from "routing-controllers";
import {Request, Response} from "express";

export class CheckAuthenticatedApiMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (!!request.user) {
			next();
			return;
		}
		throw new UnauthorizedError(request.path + ' requires authentication');
	}

}
