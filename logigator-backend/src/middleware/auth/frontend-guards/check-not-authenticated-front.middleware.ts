import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import {redirect} from '../../../functions/redirect';

export class CheckNotAuthenticatedFrontMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			redirect(request, response, {target: '/'});
			return;
		}
		next();
	}

}
