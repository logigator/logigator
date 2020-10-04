import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import {redirect} from '../../../functions/redirect';
import {updateAuthenticatedCookie} from '../../../functions/update-authenticated-cookie';

export class CheckAuthenticatedFrontMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.isAuthenticated()) {
			next();
			return;
		}
		updateAuthenticatedCookie(request, response, false);
		redirect(request, response, {target: '/'});
	}

}
