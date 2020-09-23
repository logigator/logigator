import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import {redirect} from '../../../functions/redirect';

export class CheckAuthenticatedFrontMiddleware implements ExpressMiddlewareInterface {



	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			next();
			return;
		}
		redirect(request, response, {target: '/'});
	}

}
