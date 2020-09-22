import {ExpressMiddlewareInterface, UnauthorizedError} from 'routing-controllers';
import {Request, Response} from 'express';

export class CheckAuthenticatedApiMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			next();
			return;
		}
		throw new UnauthorizedError(request.originalUrl + ' requires authentication');
	}

}
