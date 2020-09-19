import {ExpressMiddlewareInterface, Middleware, NotFoundError} from 'routing-controllers';
import {Request, Response} from 'express';

@Middleware({type: 'after'})
export class NotFoundMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		if (request.route) {
			next();
			return;
		}

		if (request.path.startsWith('/api')) {
			throw new NotFoundError(request.path + ' cannot be found on this server');
		}

		response.status(404);
		response.render('not-found');
	}

}
