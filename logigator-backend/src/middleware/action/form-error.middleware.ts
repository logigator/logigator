import {BadRequestError, ExpressErrorMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';

export class FormErrorMiddleware implements ExpressErrorMiddlewareInterface {

	error(error: any, request: Request, response: Response, next: (err?: any) => any): void {
		if (!(error instanceof BadRequestError && (('errors' in error && 'paramName' in error) || error.name === 'FormDataError'))) {
			throw error;
		}

		console.log(error);

		const formErrors = {
			test: 'kek'
		};

		request.session.formErrors = formErrors;

		response.redirect(request.get('Referer'));
	}

}
