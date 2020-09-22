import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';

export class CheckNotAuthenticatedFrontMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			response.redirect(`/${request.session.preferences.lang}`);
			return;
		}
		next();
	}

}
