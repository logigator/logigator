import {BadRequestError, ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';

export class CheckNotAuthenticatedApiMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			throw new BadRequestError(request.originalUrl + ' cannot be used by authenticated users');
		}
		next();
	}

}
