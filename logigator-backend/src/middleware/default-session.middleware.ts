import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';

@Middleware({type: 'before'})
export class DefaultSessionMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (!request.session.preferences) {
			request.session.preferences = {
				lang: 'en',
				theme: 'dark'
			};
		}
		next();
	}

}
