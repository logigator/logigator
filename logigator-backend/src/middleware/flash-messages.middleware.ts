import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';

export class FlashMessagesMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
	}

}
