import {BadRequestError, ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';
import {validateOrReject} from 'class-validator';
import {plainToClass} from 'class-transformer';
import {LocalLogin} from '../../models/request/frontend/auth/local-login';

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
		return passport.authenticate('local', {
			failureRedirect: '/',
			successRedirect: '/'
		})(request, response, next);
	}

}
