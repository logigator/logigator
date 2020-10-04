import {BadRequestError, ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';
import {validateOrReject} from 'class-validator';
import {plainToClass} from 'class-transformer';
import {LocalLogin} from '../../models/request/frontend/auth/local-login';
import {User} from '../../database/entities/user.entity';
import {redirect} from '../../functions/redirect';
import {updateAuthenticatedCookie} from '../../functions/update-authenticated-cookie';

export class LocalAuthenticationMiddleware implements ExpressMiddlewareInterface {

	async use(request: Request, response: Response, next?: (err?: any) => any): Promise<any> {
		try {
			await validateOrReject(plainToClass(LocalLogin, request.body));
		} catch (validationErrors) {
			const error: any = new BadRequestError(`Invalid body, check 'errors' property for more info.`);
			error.errors = validationErrors;
			error.paramName = 'body';
			throw error;
		}
		return passport.authenticate('local', (err, user: User) => {
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
