import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';

export class CheckAuthenticatedFrontMiddleware implements ExpressMiddlewareInterface {



	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			next();
			return;
		}
		response.redirect(`/${request.session.preferences.lang}`);
	}

}
