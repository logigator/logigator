import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {User} from '../../database/entities/user.entity';

@Middleware({type: 'before'})
export class UserDataMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next: (err?: any) => any): any {
		response.locals.isAuthenticated = request.isAuthenticated();
		if (request.isAuthenticated()) {
			response.locals.user = {
				username: (request.user as User).username,
				email: (request.user as User).email,
				image: (request.user as User).image?.publicUrl ?? '/assets/default-user.svg'
			};
		}
		response.locals.preferences = request.cookies.preferences;
		response.locals.acceptedCookies = request.cookies.acceptedCookies;
		next();
	}

}
