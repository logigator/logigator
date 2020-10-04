import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';
import {User} from '../../database/entities/user.entity';
import {redirect} from '../../functions/redirect';
import {updateAuthenticatedCookie} from '../../functions/update-authenticated-cookie';

export class TwitterAuthenticationMiddleware implements ExpressMiddlewareInterface {

	use(request: Request, response: Response, next?: (err?: any) => any): any {
		return passport.authenticate('twitter', (err, user: User) => {
			if (err) {
				return next(err);
			}
			request.login(user, loginErr => {
				if (loginErr) {
					return next(loginErr);
				}
				updateAuthenticatedCookie(request, response, true);
				return redirect(request, response, { target: '/'});
			});
		})(request, response, next);
	}

}
