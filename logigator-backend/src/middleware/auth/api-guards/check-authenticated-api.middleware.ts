import {ExpressMiddlewareInterface, UnauthorizedError} from 'routing-controllers';
import {Request, Response} from 'express';
import {updateAuthenticatedCookie} from '../../../functions/update-authenticated-cookie';

export class CheckAuthenticatedApiMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			next();
			return;
		}
		updateAuthenticatedCookie(request, response, false);
		throw new UnauthorizedError(request.originalUrl + ' requires authentication');
	}

}
