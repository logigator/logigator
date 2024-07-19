import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';

@Middleware({type: 'before'})
export class TrailingSlashMiddleware implements ExpressMiddlewareInterface {

	use(req: Request, res: Response, next: (err?: any) => any): any {
		if (req.url.startsWith('/api')) {
			next();
			return;
		}

		if (req.path.slice(-1) === '/' && req.path.length > 1) {
			const query = req.url.slice(req.path.length);
			const safepath = req.path.slice(0, -1).replace(/\/+/g, '/');
			res.redirect(301, safepath + query);
		} else {
			next();
		}
	}

}
